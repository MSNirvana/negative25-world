import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';
import type { ImportBatchRecord, ImportJob } from '@negative25/contracts';
import { PostgresImportPersistence } from './persistence.js';
import { MemoryImportPersistence, createImportPersistenceFromEnv } from './persistence.js';

describe('worker persistence configuration', () => {
  it('does not connect to an ambient database unless database mode is explicit', () => {
    expect(createImportPersistenceFromEnv({ DATABASE_URL: 'postgres://invalid.example/negative25' })).toBeInstanceOf(MemoryImportPersistence);
  });
});

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

integration('worker PostgreSQL persistence', () => {
  it('writes an imported photo, private original, public variants, and batch counts', async () => {
    const db = postgres(databaseUrl!, { max: 1 });
    const workspaceId = randomUUID();
    const userId = randomUUID();
    const batchId = randomUUID();
    const itemId = randomUUID();
    const photoId = `integration-${workspaceId}`;
    const job: ImportJob = { batchId, itemId, workspaceId };
    try {
      await db.unsafe(await readFile(resolve(import.meta.dirname, '../../api/src/db/migrations/0001_initial.sql'), 'utf8'));
      await db`INSERT INTO users (id, email) VALUES (${userId}, ${`${workspaceId}@worker.test`})`;
      await db`INSERT INTO workspaces (id, slug, name) VALUES (${workspaceId}, ${`worker-${workspaceId}`}, 'Worker test')`;
      await db`INSERT INTO import_batches (id, workspace_id, actor_id, status, total_count) VALUES (${batchId}, ${workspaceId}, ${userId}, 'queued', 1)`;
      await db`INSERT INTO import_items (id, batch_id, source_key, status) VALUES (${itemId}, ${batchId}, ${`workspaces/${workspaceId}/uploads/photo.jpg`}, 'queued')`;

      const persistence = new PostgresImportPersistence(db);
      expect(await persistence.markProcessing(job)).toMatchObject({ id: itemId, status: 'processing' });
      await persistence.completeItem(job, {
        id: photoId,
        workspaceId,
        checksum: 'a'.repeat(64),
        title: 'Worker photo',
        description: '',
        metadata: { cameraModel: 'Test camera' },
        files: [
          { kind: 'original', storageKey: `workspaces/${workspaceId}/uploads/photo.jpg`, checksum: 'a'.repeat(64), width: 20, height: 10, format: 'jpeg', byteSize: 100, isPrivate: true },
          { kind: 'thumbnail', storageKey: `workspaces/${workspaceId}/photos/${photoId}/thumbnail.jpg`, checksum: 'b'.repeat(64), width: 20, height: 10, format: 'jpeg', byteSize: 50, isPrivate: false },
          { kind: 'preview', storageKey: `workspaces/${workspaceId}/photos/${photoId}/preview.jpg`, checksum: 'c'.repeat(64), width: 20, height: 10, format: 'jpeg', byteSize: 60, isPrivate: false },
          { kind: 'large', storageKey: `workspaces/${workspaceId}/photos/${photoId}/large.jpg`, checksum: 'd'.repeat(64), width: 20, height: 10, format: 'jpeg', byteSize: 70, isPrivate: false },
        ],
      }, [], { cameraModel: 'Test camera' });

      const itemRows = await db`SELECT status, checksum FROM import_items WHERE id = ${itemId}`;
      const photoRows = await db`SELECT id, metadata FROM photos WHERE id = ${photoId}`;
      const fileRows = await db`SELECT kind, is_private FROM photo_files WHERE photo_id = ${photoId} ORDER BY kind`;
      const batchRows = await db`SELECT status, completed_count, failed_count FROM import_batches WHERE id = ${batchId}`;
      expect(itemRows[0]).toMatchObject({ status: 'completed', checksum: 'a'.repeat(64) });
      expect(photoRows[0]).toMatchObject({ id: photoId, metadata: { cameraModel: 'Test camera' } });
      expect(fileRows).toEqual([
        { kind: 'large', is_private: false },
        { kind: 'original', is_private: true },
        { kind: 'preview', is_private: false },
        { kind: 'thumbnail', is_private: false },
      ]);
      expect(batchRows[0]).toMatchObject({ status: 'completed', completed_count: 1, failed_count: 0 });
    } finally {
      await db`DELETE FROM workspaces WHERE id = ${workspaceId}`.catch(() => undefined);
      await db.end();
    }
  }, 30_000);
});
