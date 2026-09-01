import { z } from 'zod';

export const ImportStatusSchema = z.enum(['uploaded', 'preview', 'queued', 'processing', 'completed', 'failed', 'cancelled']);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;
export const ImportItemStatusSchema = ImportStatusSchema;
export const ImportPreviewItemSchema = z.object({
  sourceKey: z.string().min(1),
  status: ImportItemStatusSchema,
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  resolvedFields: z.record(z.unknown()),
});
export const ImportPreviewSchema = z.object({
  id: z.string().min(1),
  status: ImportStatusSchema,
  items: z.array(ImportPreviewItemSchema),
  counts: z.object({ total: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), failed: z.number().int().nonnegative() }),
  publishedCount: z.number().int().nonnegative().optional(),
});
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

export const ImportBatchSummarySchema = z.object({
  id: z.string().min(1),
  status: ImportStatusSchema,
  counts: z.object({ total: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), failed: z.number().int().nonnegative() }),
  createdAt: z.string().datetime({ offset: true }),
  publishedCount: z.number().int().nonnegative().optional(),
});
export type ImportBatchSummary = z.infer<typeof ImportBatchSummarySchema>;

export const ImportPublishResponseSchema = z.object({
  publishedCount: z.number().int().nonnegative(),
});
export type ImportPublishResponse = z.infer<typeof ImportPublishResponseSchema>;

/** Queue payload shared by the API producer and the background worker. */
export const IMPORT_QUEUE = 'negative25-imports' as const;
export type ImportJob = { batchId: string; itemId: string; workspaceId: string };

export type ImportItemRecord = {
  id: string;
  batchId: string;
  workspaceId: string;
  sourceKey: string;
  status: ImportStatus;
  checksum?: string;
  errors: string[];
  warnings: string[];
  resolvedFields: Record<string, unknown>;
};

export type ImportBatchRecord = {
  id: string;
  workspaceId: string;
  actorId: string;
  status: ImportStatus;
  idempotencyKey?: string;
  items: ImportItemRecord[];
  counts: { total: number; completed: number; failed: number };
  publishedCount?: number;
};

export type ImportJobPublisher = {
  publish(job: ImportJob): Promise<void>;
  close?(): Promise<void>;
};

export type ImportVariantRecord = {
  kind: 'original' | 'thumbnail' | 'preview' | 'large';
  storageKey: string;
  checksum: string;
  width: number;
  height: number;
  format: string;
  byteSize: number;
  isPrivate: boolean;
};

export type ImportedPhotoRecord = {
  id: string;
  checksum: string;
  title: string;
  description: string;
  capturedAt?: string;
  capturedAtLocal?: string;
  latitude?: number;
  longitude?: number;
  rating?: number | null;
  published?: boolean;
  hidden?: boolean;
  resolvedFields: Record<string, unknown>;
  variants: ImportVariantRecord[];
};

export type ImportPersistencePort = {
  findItem(job: ImportJob): Promise<ImportItemRecord | undefined>;
  beginItem(job: ImportJob): Promise<'started' | 'completed' | 'cancelled' | 'missing'>;
  completeItem(job: ImportJob, result: ImportedPhotoRecord, warnings: string[]): Promise<void>;
  failItem(job: ImportJob, error: string): Promise<void>;
  close?(): Promise<void>;
};
