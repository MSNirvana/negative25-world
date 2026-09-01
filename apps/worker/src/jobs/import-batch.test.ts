import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { ImportBatchRecord } from '@negative25/contracts';
import { transitionItem } from './import-batch.js';
import { processImportJob } from './import-batch.js';
import { MemoryImportPersistence } from '../persistence.js';
import { MemoryObjectStorage } from '../storage.js';
import { vi } from 'vitest';
import { fetchElevation } from '@negative25/utils';

vi.mock('@negative25/utils', async () => {
  const actual = await vi.importActual<typeof import('@negative25/utils')>('@negative25/utils');
  return { ...actual, fetchElevation: vi.fn() };
});

describe('import item state machine', () => {
  it('fills missing altitude from coordinates without replacing EXIF altitude', async () => {
    const lookup = vi.mocked(fetchElevation);
    lookup.mockResolvedValueOnce(142.5);
    const source = await sharp({ create: { width: 32, height: 20, channels: 3, background: { r: 30, g: 80, b: 120 } } }).jpeg().toBuffer();
    const job = { batchId: 'batch-altitude', itemId: 'item-altitude', workspaceId: 'space-1' };
    const batch: ImportBatchRecord = { id: job.batchId, workspaceId: job.workspaceId, actorId: 'user-1', status: 'queued', items: [{ id: job.itemId, batchId: job.batchId, workspaceId: job.workspaceId, sourceKey: 'workspaces/space-1/uploads/sunset.jpg', status: 'queued', errors: [], warnings: [], resolvedFields: { latitude: 39.9, longitude: 116.4 } }], counts: { total: 1, completed: 0, failed: 0 } };
    const persistence = new MemoryImportPersistence([batch]);
    const storage = new MemoryObjectStorage([{ key: 'workspaces/space-1/uploads/sunset.jpg', body: source, contentType: 'image/jpeg' }]);
    await processImportJob(job, { persistence, storage });
    expect(lookup.mock.calls[0]?.[0]).toEqual({ latitude: 39.9, longitude: 116.4 });
    expect([...persistence.photos.values()][0]?.metadata.altitude).toBe(142.5);
  });

  it('allows retry from failed and rejects skipping states', () => {
    expect(transitionItem({ id: '1', status: 'uploaded', errors: [], warnings: [] }, 'preview').status).toBe('preview');
    expect(transitionItem({ id: '1', status: 'failed', errors: ['bad'], warnings: [] }, 'queued').status).toBe('queued');
    expect(() => transitionItem({ id: '1', status: 'uploaded', errors: [], warnings: [] }, 'completed')).toThrow(/Invalid/);
  });

  it('imports a JPEG, generates public variants, and completes the batch', async () => {
    const source = await sharp({ create: { width: 32, height: 20, channels: 3, background: { r: 30, g: 80, b: 120 } } }).jpeg().toBuffer();
    const job = { batchId: 'batch-1', itemId: 'item-1', workspaceId: 'space-1' };
    const batch: ImportBatchRecord = {
      id: job.batchId,
      workspaceId: job.workspaceId,
      actorId: 'user-1',
      status: 'queued',
      items: [{ id: job.itemId, batchId: job.batchId, workspaceId: job.workspaceId, sourceKey: 'workspaces/space-1/uploads/sunset.jpg', status: 'queued', errors: [], warnings: [], resolvedFields: {} }],
      counts: { total: 1, completed: 0, failed: 0 },
    };
    const persistence = new MemoryImportPersistence([batch]);
    const storage = new MemoryObjectStorage([{ key: 'workspaces/space-1/uploads/sunset.jpg', body: source, contentType: 'image/jpeg' }]);

    await processImportJob(job, { persistence, storage });

    expect(persistence.batches.get(job.batchId)?.status).toBe('completed');
    expect(persistence.batches.get(job.batchId)?.items[0]?.status).toBe('completed');
    expect(persistence.photos.size).toBe(1);
    const photo = [...persistence.photos.values()][0];
    expect(photo?.files.map((file) => file.kind)).toEqual(['original', 'thumbnail', 'preview', 'large']);
    expect(storage.get(photo?.files.find((file) => file.kind === 'preview')?.storageKey ?? '')?.contentType).toBe('image/jpeg');
  });

  it('records a failed item for invalid image data and ignores duplicate delivery', async () => {
    const job = { batchId: 'batch-2', itemId: 'item-2', workspaceId: 'space-1' };
    const batch: ImportBatchRecord = {
      id: job.batchId,
      workspaceId: job.workspaceId,
      actorId: 'user-1',
      status: 'queued',
      items: [{ id: job.itemId, batchId: job.batchId, workspaceId: job.workspaceId, sourceKey: 'workspaces/space-1/uploads/bad.jpg', status: 'queued', errors: [], warnings: [], resolvedFields: {} }],
      counts: { total: 1, completed: 0, failed: 0 },
    };
    const persistence = new MemoryImportPersistence([batch]);
    const storage = new MemoryObjectStorage([{ key: 'workspaces/space-1/uploads/bad.jpg', body: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' }]);

    await processImportJob(job, { persistence, storage });
    await processImportJob(job, { persistence, storage });

    const item = persistence.batches.get(job.batchId)?.items[0];
    expect(item?.status).toBe('failed');
    expect(item?.errors).toHaveLength(1);
    expect(persistence.photos.size).toBe(0);
  });
});
