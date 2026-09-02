import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('admin API authorization', () => {
  it('allows an owner to edit publication state and rejects unknown photo IDs', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const summary = await app.inject({ method: 'GET', url: '/api/v1/admin/spaces/primary/summary', headers: { authorization } });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({ workspace: { slug: 'primary', role: 'owner' }, stats: { photoCount: 1, publishedPhotoCount: 1, pendingImportCount: 0 }, recentActivity: [] });
    const members = await app.inject({ method: 'GET', url: '/api/v1/admin/spaces/primary/members', headers: { authorization } });
    expect(members.statusCode).toBe(200);
    expect(members.json()).toEqual([{ userId: expect.any(String), email: 'owner@n25.world', name: 'negative25 Owner', role: 'owner' }]);
    const selfRoleChange = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/members/00000000-0000-4000-8000-000000000001', headers: { authorization }, payload: { role: 'viewer' } });
    expect(selfRoleChange.statusCode).toBe(409);
    const update = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization }, payload: { title: 'Updated title', description: 'A note', rating: 4, published: false, hidden: true } });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({ title: 'Updated title', description: 'A note', rating: 4, published: false, hidden: true });
    const sevenStars = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization }, payload: { rating: 7 } });
    expect(sevenStars.statusCode).toBe(200);
    expect(sevenStars.json()).toMatchObject({ rating: 7 });
    const eightStars = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization }, payload: { rating: 8 } });
    expect(eightStars.statusCode).toBe(400);
    const publicRead = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos' });
    expect(publicRead.json().photos).toHaveLength(0);
    const missing = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/missing', headers: { authorization }, payload: { title: 'Nope' } });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('supports bulk copy responses and single photo deletion', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const copy = await app.inject({ method: 'POST', url: '/api/v1/admin/spaces/primary/photos/bulk-copy', headers: { authorization }, payload: { sourcePhotoId: 'primary-photo-1', targetPhotoIds: ['missing-photo'], fields: ['rating'] } });
    expect(copy.statusCode).toBe(200);
    expect(copy.json()).toEqual({ photos: [], skippedIds: ['missing-photo'] });
    const deleted = await app.inject({ method: 'DELETE', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization } });
    expect(deleted.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/spaces/primary/photos', headers: { authorization } })).json()).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization } })).statusCode).toBe(404);
    await app.close();
  });

  it('supports saving and clearing a custom photo location', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const located = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/spaces/primary/photos/primary-photo-1',
      headers: { authorization },
      payload: { location: { name: '北京故宫', latitude: 39.9163, longitude: 116.3972, displayAddress: '故宫博物院', displayRegion: '北京市', displayRegionEnabled: true } },
    });
    expect(located.statusCode).toBe(200);
    expect(located.json()).toMatchObject({ location: { name: '北京故宫' }, latitude: 39.9163, longitude: 116.3972, metadata: { displayAddress: '故宫博物院', displayRegion: '北京市', displayRegionEnabled: true } });
    const publicRead = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos' });
    expect(publicRead.json().photos[0]).toMatchObject({ location: { name: '北京故宫' }, metadata: { latitude: 39.9163, longitude: 116.3972, displayAddress: '故宫博物院', displayRegion: '北京市', displayRegionEnabled: true } });
    const cleared = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization }, payload: { location: null } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().location).toBeNull();
    expect(cleared.json()).not.toHaveProperty('latitude');
    expect(cleared.json()).not.toHaveProperty('longitude');
    expect(cleared.json().metadata).not.toHaveProperty('displayAddress');
    expect(cleared.json().metadata).not.toHaveProperty('displayRegion');
    expect(cleared.json().metadata).not.toHaveProperty('displayRegionEnabled');
    await app.close();
  });

  it('keeps owner-only photos published for the owner but excludes them from public reads', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const ownerOnly = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/spaces/primary/photos/primary-photo-1',
      headers: { authorization },
      payload: { ownerOnly: true },
    });
    expect(ownerOnly.statusCode).toBe(200);
    expect(ownerOnly.json()).toMatchObject({ published: true, hidden: false, ownerOnly: true, metadata: { ownerOnly: true } });
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/spaces/primary/photos', headers: { authorization } })).json()).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos' })).json().photos).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: '/api/v1/photos/primary-photo-1' })).statusCode).toBe(404);

    const restored = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/spaces/primary/photos/primary-photo-1',
      headers: { authorization },
      payload: { ownerOnly: false },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ published: true, hidden: false, ownerOnly: false });
    expect(restored.json().metadata).not.toHaveProperty('ownerOnly');
    expect((await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/photos' })).json().photos).toHaveLength(1);
    await app.close();
  });
});
