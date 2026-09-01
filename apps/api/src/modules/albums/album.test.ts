import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('album API', () => {
  it('creates, lists, edits, and deletes albums within a workspace', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/spaces/primary/albums', headers: { authorization }, payload: { title: 'First light', description: 'Morning frames', shootDate: '2026-01-02', photoIds: ['primary-photo-1'], coverPhotoId: 'primary-photo-1' } });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ id: expect.any(String), title: 'First light', shootDate: '2026-01-02', photoIds: ['primary-photo-1'], photoCount: 1 });
    const list = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/albums' });
    expect(list.statusCode).toBe(200);
    expect(list.json().albums).toMatchObject([{ id: created.json().id, shootDate: '2026-01-02', photoCount: 1, cover: { id: 'primary-photo-1' } }]);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/spaces/primary/albums/${created.json().id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().photos).toHaveLength(1);

    const hidden = await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization }, payload: { published: false, hidden: true } });
    expect(hidden.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/albums' })).json().albums).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/api/v1/spaces/primary/albums/${created.json().id}` })).statusCode).toBe(404);
    await app.inject({ method: 'PATCH', url: '/api/v1/admin/spaces/primary/photos/primary-photo-1', headers: { authorization }, payload: { published: true, hidden: false } });

    const updated = await app.inject({ method: 'PATCH', url: `/api/v1/admin/spaces/primary/albums/${created.json().id}`, headers: { authorization }, payload: { title: 'Dawn collection', photoIds: [] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ title: 'Dawn collection', shootDate: '2026-01-02', photoIds: [], photoCount: 0 });
    const hiddenList = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/albums' });
    expect(hiddenList.json().albums).toHaveLength(0);

    const deleted = await app.inject({ method: 'DELETE', url: `/api/v1/admin/spaces/primary/albums/${created.json().id}`, headers: { authorization } });
    expect(deleted.statusCode).toBe(204);
    const missing = await app.inject({ method: 'DELETE', url: `/api/v1/admin/spaces/primary/albums/${created.json().id}`, headers: { authorization } });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('validates the optional shoot date and does not require a slug', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/admin/spaces/primary/albums', headers: { authorization }, payload: { title: 'Invalid date', shootDate: '2026-02-30' } });
    expect(invalid.statusCode).toBe(400);
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/spaces/primary/albums', headers: { authorization }, payload: { title: 'No slug needed' } });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ title: 'No slug needed', shootDate: null });
    await app.close();
  });

  it('does not expose non-public non-primary spaces anonymously', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/spaces/other/albums' });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
