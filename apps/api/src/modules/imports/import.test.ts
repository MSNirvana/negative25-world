import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { ImportService } from './import.service.js';
import { MemoryRepository, PRIMARY_WORKSPACE_ID } from '../../db/repository.js';

describe('import batch API', () => {
  it('supports preview, confirm, cancellation and idempotent creation', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const payload = { spaceSlug: 'primary', sourceKeys: ['photos/a.jpg'], idempotencyKey: 'batch-1' };
    const created = await app.inject({ method: 'POST', url: '/api/v1/imports', headers: { authorization }, payload });
    expect(created.statusCode).toBe(200);
    const duplicate = await app.inject({ method: 'POST', url: '/api/v1/imports', headers: { authorization }, payload });
    expect(duplicate.json().id).toBe(created.json().id);
    const preview = await app.inject({ method: 'POST', url: `/api/v1/imports/${created.json().id}/preview`, headers: { authorization } });
    expect(preview.json().status).toBe('preview');
    const confirmed = await app.inject({ method: 'POST', url: `/api/v1/imports/${created.json().id}/confirm`, headers: { authorization } });
    expect(confirmed.json().status).toBe('queued');
    const history = await app.inject({ method: 'GET', url: '/api/v1/spaces/primary/imports', headers: { authorization } });
    expect(history.statusCode).toBe(200);
    expect(history.json()[0]).toMatchObject({ id: created.json().id, status: 'queued', counts: { total: 1, completed: 0, failed: 0 } });
    const cancelled = await app.inject({ method: 'POST', url: `/api/v1/imports/${created.json().id}/cancel`, headers: { authorization } });
    expect(cancelled.json().status).toBe('cancelled');
    const canonical = await app.inject({ method: 'POST', url: '/api/v1/spaces/primary/imports', headers: { authorization }, payload: { sourceKeys: ['photos/b.jpg'] } });
    expect(canonical.statusCode).toBe(200);
    const empty = await app.inject({ method: 'POST', url: '/api/v1/imports', headers: { authorization }, payload: { spaceSlug: 'primary', sourceKeys: [] } });
    expect(empty.statusCode).toBe(400);
    await app.close();
  });
});

describe('import queue integration', () => {
  it('publishes one stable job per queued item after confirmation', async () => {
    const jobs: Array<{ batchId: string; itemId: string; workspaceId: string }> = [];
    const service = new ImportService(new MemoryRepository(), { publish: async (job) => { jobs.push(job); } });
    const actor = { userId: 'user-1', workspaceId: PRIMARY_WORKSPACE_ID, role: 'editor' as const };
    const created = await service.createBatch(actor, ['workspaces/space/uploads/a.jpg', 'workspaces/space/uploads/b.jpg']);
    await service.preview(actor, created.id);
    const confirmed = await service.confirm(actor, created.id);
    expect(confirmed.status).toBe('queued');
    expect(jobs).toHaveLength(2);
    await service.confirm(actor, created.id);
    expect(jobs).toHaveLength(4);
    expect(jobs.every((job) => job.batchId === created.id && job.workspaceId === PRIMARY_WORKSPACE_ID)).toBe(true);
    expect(new Set(jobs.map((job) => job.itemId)).size).toBe(2);
  });
});

describe('import batch publishing', () => {
  it('publishes completed photos from one batch idempotently', async () => {
    const repository = new MemoryRepository();
    const service = new ImportService(repository);
    const actor = { userId: 'user-1', workspaceId: PRIMARY_WORKSPACE_ID, role: 'editor' as const };
    const batch = await service.createBatch(actor, ['workspaces/primary/uploads/photo.jpg']);
    const stored = await repository.findBatch(batch.id, PRIMARY_WORKSPACE_ID);
    if (!stored?.items[0]) throw new Error('Expected import item');
    stored.items[0].status = 'completed';
    stored.items[0].checksum = 'batch-photo-checksum';
    stored.status = 'completed';
    stored.counts = { total: 1, completed: 1, failed: 0 };
    await repository.saveBatch(stored);
    await repository.savePhoto({ id: 'batch-photo', workspaceId: PRIMARY_WORKSPACE_ID, checksum: 'batch-photo-checksum', title: 'Batch photo', description: '', published: false, hidden: false, rating: null });

    await expect(service.publish(actor, batch.id)).resolves.toEqual({ publishedCount: 1 });
    await expect(service.publish(actor, batch.id)).resolves.toEqual({ publishedCount: 1 });
    await expect(repository.findPhoto(PRIMARY_WORKSPACE_ID, 'batch-photo')).resolves.toMatchObject({ published: true, hidden: false });
  });

  it('rejects publishing a batch without completed photos', async () => {
    const repository = new MemoryRepository();
    const service = new ImportService(repository);
    const actor = { userId: 'user-1', workspaceId: PRIMARY_WORKSPACE_ID, role: 'editor' as const };
    const batch = await service.createBatch(actor, ['workspaces/primary/uploads/photo.jpg']);
    await expect(service.publish(actor, batch.id)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a viewer before attempting to publish', async () => {
    const repository = new MemoryRepository();
    const service = new ImportService(repository);
    const editor = { userId: 'user-1', workspaceId: PRIMARY_WORKSPACE_ID, role: 'editor' as const };
    const batch = await service.createBatch(editor, ['workspaces/primary/uploads/photo.jpg']);

    await expect(service.publish({ ...editor, role: 'viewer' }, batch.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('import publish route', () => {
  it('returns a conflict when the requested batch has no completed photos', async () => {
    const app = buildApp();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'owner@n25.world', password: 'negative25' } });
    const authorization = `Bearer ${login.json().accessToken}`;
    const created = await app.inject({ method: 'POST', url: '/api/v1/spaces/primary/imports', headers: { authorization }, payload: { sourceKeys: ['photos/not-ready.jpg'] } });

    const response = await app.inject({ method: 'POST', url: `/api/v1/spaces/primary/imports/${created.json().id}/publish`, headers: { authorization } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('CONFLICT');
    await app.close();
  });
});
