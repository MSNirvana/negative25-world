import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('versioned API core', () => {
  it('returns a request id and supports login, me, refresh', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    expect(login.statusCode).toBe(200);
    expect(login.headers['x-request-id']).toBeTruthy();
    const session = login.json();
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('owner@n25.world');
    const workspaces = await app.inject({ method: 'GET', url: '/api/v1/workspaces', headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(workspaces.statusCode).toBe(200);
    expect(workspaces.json()).toEqual([{ id: expect.any(String), slug: 'primary', name: 'negative25', role: 'owner' }]);
    const refresh = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: session.refreshToken } });
    expect(refresh.statusCode).toBe(200);
    await app.close();
  });

  it('rejects invalid login and cross-workspace membership', async () => {
    const app = buildApp();
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'wrong' } });
    expect(invalid.statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const response = await app.inject({ method: 'GET', url: '/api/v1/spaces/other/photos', headers: { authorization: `Bearer ${login.json().accessToken}` } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    await app.close();
  });

  it('serves only published, visible photos with validated modes', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos?mode=featured' });
    expect(response.statusCode).toBe(200);
    expect(response.json().photos.every((photo: { published: boolean; hidden: boolean }) => photo.published && !photo.hidden)).toBe(true);
    const invalid = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos?mode=unsupported' });
    expect(invalid.statusCode).toBe(400);
    const detail = await app.inject({ method: 'GET', url: '/api/v1/photos/primary-photo-1' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: 'primary-photo-1', spaceSlug: 'primary' });
    await app.close();
  });

  it('registers a username account, creates a personal workspace, verifies email, and saves profile', async () => {
    const app = buildApp();
    const registered = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username: '  mountain_view ', email: 'MOUNTAIN@EXAMPLE.COM', password: 'secure123', passwordConfirmation: 'secure123' } });
    expect(registered.statusCode).toBe(200);
    expect(registered.json().user).toMatchObject({ username: 'mountain_view', email: 'mountain@example.com', emailVerifiedAt: null });
    const session = registered.json().session as { accessToken: string };
    const defaultProfile = await app.inject({ method: 'GET', url: '/api/v1/me/profile', headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(defaultProfile.json()).toMatchObject({ username: 'mountain_view', profilePublic: true });
    const verification = registered.json().devVerification as { code: string };
    const verified = await app.inject({ method: 'POST', url: '/api/v1/auth/email/verify', payload: { email: 'mountain@example.com', code: verification.code } });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().user.emailVerifiedAt).toBeTruthy();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: 'mountain_view', password: 'secure123' } });
    expect(login.statusCode).toBe(200);
    const profile = await app.inject({ method: 'PATCH', url: '/api/v1/me/profile', headers: { authorization: `Bearer ${login.json().accessToken}` }, payload: { displayName: 'Mountain View', bio: 'Light and distance.', profilePublic: true } });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ username: 'mountain_view', displayName: 'Mountain View', profilePublic: true });
    const publicProfile = await app.inject({ method: 'GET', url: '/api/v1/users/mountain_view/profile' });
    expect(publicProfile.statusCode).toBe(200);
    expect(publicProfile.json()).not.toHaveProperty('email');
    expect(publicProfile.json()).toMatchObject({ username: 'mountain_view', displayName: 'Mountain View' });
    expect(publicProfile.json().photos).toEqual([]);
    const search = await app.inject({ method: 'GET', url: '/api/v1/users/search?q=mountain' });
    expect(search.statusCode).toBe(200);
    expect(search.json().users).toMatchObject([{ username: 'mountain_view', displayName: 'Mountain View' }]);
    await app.close();
  });

  it('isolates a new account gallery to its personal workspace', async () => {
    const app = buildApp();
    const registered = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username: 'gallery_owner', email: 'gallery_owner@example.com', password: 'secure123', passwordConfirmation: 'secure123' } });
    expect(registered.statusCode).toBe(200);
    const session = registered.json().session as { accessToken: string };
    const workspaces = await app.inject({ method: 'GET', url: '/api/v1/workspaces', headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(workspaces.statusCode).toBe(200);
    const personalSlug = (workspaces.json() as Array<{ slug: string }>).find((workspace) => workspace.slug.startsWith('u-'))?.slug;
    expect(personalSlug).toBeTruthy();
    const privateGallery = await app.inject({ method: 'GET', url: `/api/v1/spaces/${personalSlug}/photos?mode=featured`, headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(privateGallery.statusCode).toBe(200);
    expect(privateGallery.json().photos).toEqual([]);
    const anonymousPublicGallery = await app.inject({ method: 'GET', url: `/api/v1/spaces/${personalSlug}/photos?mode=featured` });
    expect(anonymousPublicGallery.statusCode).toBe(200);
    const publicGallery = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos?mode=featured' });
    expect(publicGallery.statusCode).toBe(200);
    await app.close();
  });

  it('allows anonymous reads of a public personal archive without exposing hidden photos', async () => {
    const app = buildApp();
    const registered = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { username: 'public_author', email: 'public_author@example.com', password: 'secure123', passwordConfirmation: 'secure123' } });
    const token = registered.json().session.accessToken as string;
    const spaces = await app.inject({ method: 'GET', url: '/api/v1/workspaces', headers: { authorization: `Bearer ${token}` } });
    const slug = (spaces.json() as Array<{ slug: string }>).find((space) => space.slug.startsWith('u-'))?.slug;
    expect(slug).toBeTruthy();
    const profile = await app.inject({ method: 'GET', url: '/api/v1/users/public_author/profile' });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ username: 'public_author', workspaceSlug: slug });
    const publicArchive = await app.inject({ method: 'GET', url: `/api/v1/spaces/${slug}/photos?mode=featured` });
    expect(publicArchive.statusCode).toBe(200);
    expect(publicArchive.json().photos).toEqual([]);
    await app.close();
  });
});
