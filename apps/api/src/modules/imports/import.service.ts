import { randomUUID } from 'node:crypto';
import { ApiError } from '@negative25/utils';
import type { ImportJob, ImportJobPublisher, ImportPreview, ImportStatus } from '@negative25/contracts';
import type { AppRepository, BatchRecord } from '../../db/repository.js';

export type ImportActor = { userId: string; workspaceId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
type Item = ImportPreview['items'][number] & { id: string };
type Batch = Omit<ImportPreview, 'items'> & { items: Item[]; workspaceId: string; actorId: string; idempotencyKey?: string; createdAt?: string };

export class ImportService {
  constructor(private readonly repository: AppRepository, private readonly publisher: ImportJobPublisher = noopPublisher) {}

  async createBatch(actor: ImportActor, sourceKeys: string[], idempotencyKey?: string): Promise<ImportPreview> {
    this.requireEditor(actor);
    if (idempotencyKey) {
      const existing = await this.repository.findBatchByIdempotency(actor.workspaceId, idempotencyKey);
      if (existing) return this.publicBatch(existing);
    }
    const items: Item[] = sourceKeys.filter(Boolean).map((sourceKey) => ({ id: randomUUID(), sourceKey, status: 'uploaded', errors: [], warnings: [], resolvedFields: {} }));
    const batch: Batch = { id: randomUUID(), workspaceId: actor.workspaceId, actorId: actor.userId, idempotencyKey, status: 'uploaded', items, counts: { total: items.length, completed: 0, failed: 0 }, createdAt: new Date().toISOString() };
    try {
      await this.repository.createBatch(batch as BatchRecord);
    } catch (cause) {
      // A concurrent request may win the workspace-scoped idempotency race.
      if (idempotencyKey) {
        const existing = await this.repository.findBatchByIdempotency(actor.workspaceId, idempotencyKey);
        if (existing) return this.publicBatch(existing);
      }
      throw cause;
    }
    return this.publicBatch(batch);
  }

  async getBatch(actor: ImportActor, batchId: string): Promise<ImportPreview> { return this.publicBatch(await this.getOwned(actor, batchId)); }
  async listBatches(actor: ImportActor) { this.requireWorkspaceAccess(actor); return this.repository.listImportBatches(actor.workspaceId); }
  async preview(actor: ImportActor, batchId: string): Promise<ImportPreview> { const batch = await this.getOwned(actor, batchId); this.requireEditor(actor); if (batch.status === 'uploaded') batch.status = 'preview'; await this.persist(batch); return this.publicBatch(batch); }
  async confirm(actor: ImportActor, batchId: string): Promise<ImportPreview> {
    const batch = await this.getOwned(actor, batchId);
    this.requireEditor(actor);
    // A queued batch can be confirmed again after a transient queue outage; stable job IDs make this idempotent.
    if (!['preview', 'failed', 'queued'].includes(batch.status)) throw new ApiError('CONFLICT', 'Batch is not ready to confirm');
    batch.status = 'queued';
    const queuedItems = batch.items.filter((item) => ['preview', 'failed', 'uploaded', 'queued'].includes(item.status));
    for (const item of queuedItems) item.status = 'queued';
    await this.persist(batch);
    await this.publishItems(batch, queuedItems);
    return this.publicBatch(batch);
  }
  async cancel(actor: ImportActor, batchId: string): Promise<ImportPreview> { const batch = await this.getOwned(actor, batchId); this.requireEditor(actor); if (['completed', 'cancelled'].includes(batch.status)) throw new ApiError('CONFLICT', 'Batch cannot be cancelled'); batch.status = 'cancelled'; for (const item of batch.items) if (!['completed', 'failed'].includes(item.status)) item.status = 'cancelled'; await this.persist(batch); return this.publicBatch(batch); }
  async retryFailed(actor: ImportActor, batchId: string): Promise<ImportPreview> {
    const batch = await this.getOwned(actor, batchId);
    this.requireEditor(actor);
    const queuedItems = batch.items.filter((item) => item.status === 'failed');
    for (const item of queuedItems) item.status = 'queued';
    if (batch.status === 'failed') batch.status = 'queued';
    await this.persist(batch);
    await this.publishItems(batch, queuedItems);
    return this.publicBatch(batch);
  }
  async publish(actor: ImportActor, batchId: string): Promise<{ publishedCount: number }> {
    const batch = await this.getOwned(actor, batchId);
    this.requireEditor(actor);
    if (batch.counts.completed < 1) throw new ApiError('CONFLICT', 'Batch has no completed photos to publish');
    return { publishedCount: await this.repository.publishBatchPhotos(batch.id, batch.workspaceId) };
  }

  private async getOwned(actor: ImportActor, batchId: string): Promise<Batch> { const batch = await this.repository.findBatch(batchId, actor.workspaceId); if (!batch) throw new ApiError('NOT_FOUND', 'Import batch not found'); return batch as Batch; }
  private async persist(batch: Batch): Promise<void> {
    batch.counts = {
      total: batch.items.length,
      completed: batch.items.filter((item) => item.status === 'completed').length,
      failed: batch.items.filter((item) => item.status === 'failed').length,
    };
    await this.repository.saveBatch(batch);
  }
  private async publishItems(batch: Batch, items: readonly Item[]): Promise<void> {
    for (const item of items) {
      const job: ImportJob = { batchId: batch.id, itemId: item.id, workspaceId: batch.workspaceId };
      await this.publisher.publish(job);
    }
  }
  private publicBatch(batch: BatchRecord): ImportPreview { return { id: batch.id, status: batch.status as ImportStatus, items: batch.items.map(({ id: _id, checksum: _checksum, ...item }) => item as ImportPreview['items'][number]), counts: { ...batch.counts }, publishedCount: batch.publishedCount ?? 0 }; }
  private requireEditor(actor: ImportActor): void { if (!['owner', 'admin', 'editor'].includes(actor.role)) throw new ApiError('FORBIDDEN', 'Editor access required'); }
  private requireWorkspaceAccess(actor: ImportActor): void { if (!['owner', 'admin', 'editor', 'viewer'].includes(actor.role)) throw new ApiError('FORBIDDEN', 'Workspace access required'); }
}

const noopPublisher: ImportJobPublisher = { publish: async () => undefined };
