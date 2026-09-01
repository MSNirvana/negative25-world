import postgres, { type Sql, type TransactionSql } from 'postgres';
import type { ImportBatchRecord, ImportItemRecord, ImportJob } from '@negative25/contracts';

export type ImportedPhotoFile = {
  kind: 'original' | 'thumbnail' | 'preview' | 'large';
  storageKey: string;
  checksum: string;
  width: number;
  height: number;
  format: string;
  byteSize: number;
  isPrivate: boolean;
};

export type ImportedPhoto = {
  id: string;
  workspaceId: string;
  checksum: string;
  title: string;
  description: string;
  capturedAt?: string;
  capturedAtLocal?: string;
  latitude?: number;
  longitude?: number;
  rating?: number | null;
  metadata: Record<string, unknown>;
  files: ImportedPhotoFile[];
};

export interface ImportPersistence {
  markProcessing(job: ImportJob): Promise<ImportItemRecord | undefined>;
  completeItem(job: ImportJob, photo: ImportedPhoto, warnings: string[], resolvedFields: Record<string, unknown>): Promise<void>;
  failItem(job: ImportJob, error: string, warnings?: string[]): Promise<void>;
  close(): Promise<void>;
}

export class PostgresImportPersistence implements ImportPersistence {
  constructor(private readonly db: Sql) {}

  async markProcessing(job: ImportJob): Promise<ImportItemRecord | undefined> {
    const rows = await this.db`
      UPDATE import_items AS item
      SET status = 'processing'
      FROM import_batches AS batch
      WHERE item.id = ${job.itemId}
        AND item.batch_id = ${job.batchId}
        AND batch.id = item.batch_id
        AND batch.workspace_id = ${job.workspaceId}
        AND item.status = 'queued'
      RETURNING item.id, item.batch_id AS "batchId", batch.workspace_id AS "workspaceId",
        item.source_key AS "sourceKey", item.status, item.checksum, item.errors, item.warnings,
        item.resolved_fields AS "resolvedFields"
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    await this.db`UPDATE import_batches SET status = 'processing' WHERE id = ${job.batchId} AND workspace_id = ${job.workspaceId} AND status = 'queued'`;
    return toImportItem(row);
  }

  async completeItem(job: ImportJob, photo: ImportedPhoto, warnings: string[], resolvedFields: Record<string, unknown>): Promise<void> {
    await this.db.begin(async (tx) => {
      await tx`
        INSERT INTO photos (id, workspace_id, checksum, status, title, description, metadata, captured_at,
          captured_at_local, latitude, longitude, rating, published, hidden)
        VALUES (${photo.id}, ${photo.workspaceId}, ${photo.checksum}, 'draft', ${photo.title}, ${photo.description},
          ${tx.json(JSON.parse(JSON.stringify(photo.metadata)))}, ${photo.capturedAt ?? null}, ${photo.capturedAtLocal ?? null}, ${photo.latitude ?? null}, ${photo.longitude ?? null}, ${photo.rating ?? null}, FALSE, FALSE)
        ON CONFLICT (workspace_id, checksum) DO NOTHING
      `;
      const photoRows = await tx`SELECT id FROM photos WHERE workspace_id = ${photo.workspaceId} AND checksum = ${photo.checksum} LIMIT 1`;
      const photoId = String(photoRows[0]?.id ?? photo.id);
      for (const file of photo.files) {
        await tx`
          INSERT INTO photo_files (photo_id, kind, storage_key, checksum, width, height, format, byte_size, is_private)
          VALUES (${photoId}, ${file.kind}, ${file.storageKey}, ${file.checksum}, ${file.width}, ${file.height}, ${file.format}, ${file.byteSize}, ${file.isPrivate})
          ON CONFLICT (photo_id, kind, width, height, format) DO UPDATE SET
            storage_key = EXCLUDED.storage_key, checksum = EXCLUDED.checksum, byte_size = EXCLUDED.byte_size,
            is_private = EXCLUDED.is_private
        `;
      }
      await tx`
        UPDATE import_items
        SET status = 'completed', checksum = ${photo.checksum}, warnings = ${tx.json(JSON.parse(JSON.stringify(warnings)))},
          resolved_fields = ${tx.json(JSON.parse(JSON.stringify(resolvedFields)))}
        WHERE id = ${job.itemId} AND batch_id = ${job.batchId} AND status IN ('processing', 'completed')
      `;
      await updateBatchCounts(tx, job.batchId, job.workspaceId);
    });
  }

  async failItem(job: ImportJob, error: string, warnings: string[] = []): Promise<void> {
    await this.db.begin(async (tx) => {
      await tx`
        UPDATE import_items
        SET status = 'failed', errors = COALESCE(errors, '[]'::jsonb) || ${tx.json(JSON.parse(JSON.stringify([error])))},
          warnings = COALESCE(warnings, '[]'::jsonb) || ${tx.json(JSON.parse(JSON.stringify(warnings)))}
        WHERE id = ${job.itemId} AND batch_id = ${job.batchId} AND status NOT IN ('completed', 'cancelled')
      `;
      await updateBatchCounts(tx, job.batchId, job.workspaceId);
    });
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}

export class MemoryImportPersistence implements ImportPersistence {
  readonly batches = new Map<string, ImportBatchRecord>();
  readonly photos = new Map<string, ImportedPhoto>();

  constructor(batches: ImportBatchRecord[] = []) {
    for (const batch of batches) this.batches.set(batch.id, cloneBatch(batch));
  }

  async markProcessing(job: ImportJob): Promise<ImportItemRecord | undefined> {
    const batch = this.batches.get(job.batchId);
    if (!batch || batch.workspaceId !== job.workspaceId) return undefined;
    const item = batch.items.find((candidate) => candidate.id === job.itemId);
    if (!item || item.status !== 'queued') return undefined;
    item.status = 'processing';
    batch.status = 'processing';
    return { ...item, errors: [...item.errors], warnings: [...item.warnings], resolvedFields: { ...item.resolvedFields } };
  }

  async completeItem(job: ImportJob, photo: ImportedPhoto, warnings: string[], resolvedFields: Record<string, unknown>): Promise<void> {
    const batch = this.batches.get(job.batchId);
    const item = batch?.items.find((candidate) => candidate.id === job.itemId);
    if (!batch || !item || item.status === 'cancelled') return;
    const existing = [...this.photos.values()].find((candidate) => candidate.workspaceId === photo.workspaceId && candidate.checksum === photo.checksum);
    this.photos.set(existing?.id ?? photo.id, existing ? { ...existing, files: photo.files } : clonePhoto(photo));
    item.status = 'completed';
    item.checksum = photo.checksum;
    item.warnings = [...warnings];
    item.resolvedFields = { ...resolvedFields };
    updateMemoryBatchStatus(batch);
  }

  async failItem(job: ImportJob, error: string, warnings: string[] = []): Promise<void> {
    const batch = this.batches.get(job.batchId);
    const item = batch?.items.find((candidate) => candidate.id === job.itemId);
    if (!batch || !item || ['completed', 'cancelled'].includes(item.status)) return;
    item.status = 'failed';
    item.errors = [...item.errors, error];
    item.warnings = [...item.warnings, ...warnings];
    updateMemoryBatchStatus(batch);
  }

  async close(): Promise<void> {
    // No external resources in the memory adapter.
  }
}

export function createImportPersistenceFromEnv(env: NodeJS.ProcessEnv = process.env): ImportPersistence {
  const useDatabase = env.N25_USE_DATABASE;
  if (useDatabase === '1' && env.DATABASE_URL) return new PostgresImportPersistence(postgres(env.DATABASE_URL, { max: 4 }));
  return new MemoryImportPersistence();
}

async function updateBatchCounts(tx: TransactionSql, batchId: string, workspaceId: string): Promise<void> {
  await tx`
    WITH counts AS (
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
        COUNT(*) FILTER (WHERE status = 'queued')::int AS queued
      FROM import_items WHERE batch_id = ${batchId}
    )
    UPDATE import_batches AS batch
    SET total_count = counts.total, completed_count = counts.completed, failed_count = counts.failed,
      status = CASE
        WHEN counts.total > 0 AND counts.completed = counts.total THEN 'completed'
        WHEN counts.total > 0 AND counts.completed + counts.failed = counts.total AND counts.failed > 0 THEN 'failed'
        WHEN counts.processing > 0 THEN 'processing'
        WHEN counts.queued > 0 THEN 'queued'
        ELSE batch.status
      END
    FROM counts
    WHERE batch.id = ${batchId} AND batch.workspace_id = ${workspaceId}
  `;
}

function toImportItem(row: Record<string, unknown>): ImportItemRecord {
  return {
    id: String(row.id),
    batchId: String(row.batchId),
    workspaceId: String(row.workspaceId),
    sourceKey: String(row.sourceKey),
    status: String(row.status) as ImportItemRecord['status'],
    checksum: row.checksum == null ? undefined : String(row.checksum),
    errors: arrayOfStrings(row.errors),
    warnings: arrayOfStrings(row.warnings),
    resolvedFields: objectValue(row.resolvedFields),
  };
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  return [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cloneBatch(batch: ImportBatchRecord): ImportBatchRecord {
  return { ...batch, items: batch.items.map((item) => ({ ...item, errors: [...item.errors], warnings: [...item.warnings], resolvedFields: { ...item.resolvedFields } })) };
}

function clonePhoto(photo: ImportedPhoto): ImportedPhoto {
  return { ...photo, metadata: { ...photo.metadata }, files: photo.files.map((file) => ({ ...file })) };
}

function updateMemoryBatchStatus(batch: ImportBatchRecord): void {
  batch.counts = {
    total: batch.items.length,
    completed: batch.items.filter((item) => item.status === 'completed').length,
    failed: batch.items.filter((item) => item.status === 'failed').length,
  };
  if (batch.counts.completed === batch.counts.total && batch.counts.total > 0) batch.status = 'completed';
  else if (batch.counts.completed + batch.counts.failed === batch.counts.total && batch.counts.failed > 0) batch.status = 'failed';
  else if (batch.items.some((item) => item.status === 'processing')) batch.status = 'processing';
  else if (batch.items.some((item) => item.status === 'queued')) batch.status = 'queued';
}
