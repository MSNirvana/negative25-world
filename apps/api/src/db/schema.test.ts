import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getTableName } from 'drizzle-orm';
import {
  albums, albumPhotos, auditLogs, equipment, importBatches, importItems, locations,
  mediaUploads, memberships, photoFiles, photos, users, workspaces,
} from './schema/index.js';

describe('database schema foundation', () => {
  it('exports every workspace-owned table with stable names', () => {
    expect([
      users, workspaces, memberships, photos, photoFiles, albums, albumPhotos, equipment,
      locations, importBatches, importItems, mediaUploads, auditLogs,
    ].map(getTableName)).toEqual([
      'users', 'workspaces', 'memberships', 'photos', 'photo_files', 'albums',
    'album_photos', 'equipment', 'locations', 'import_batches', 'import_items', 'media_uploads', 'audit_logs',
    ]);
  });

  it('contains tenant isolation, dedupe, cascade, and media uniqueness constraints', () => {
    const migration = readFileSync(resolve(import.meta.dirname, 'migrations/0001_initial.sql'), 'utf8');
    expect(migration).toContain('UNIQUE (workspace_id, checksum)');
    expect(migration).toContain('UNIQUE (photo_id, kind, width, height, format)');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).toContain('workspace_id UUID NOT NULL');
  });
});

const databaseUrl = process.env.DATABASE_URL;
// Database tests are opt-in so unrelated shell configuration cannot touch a live database.
const integration = databaseUrl && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

integration('database migration behavior', () => {
  it('deduplicates photos and cascades workspace-owned rows', async () => {
    const db = postgres(databaseUrl!, { max: 1 });
    try {
      const migration = readFileSync(resolve(import.meta.dirname, 'migrations/0001_initial.sql'), 'utf8');
      const albumPhotosMigration = readFileSync(resolve(import.meta.dirname, 'migrations/0002_album_photos.sql'), 'utf8');
      const albumShootDateMigration = readFileSync(resolve(import.meta.dirname, 'migrations/0003_album_shoot_date.sql'), 'utf8');
      await db.unsafe(migration);
      await db.unsafe(albumPhotosMigration);
      await db.unsafe(albumShootDateMigration);
      await db.unsafe('BEGIN');
      const workspaceId = randomUUID();
      const userId = randomUUID();
      const locationId = randomUUID();
      const batchId = randomUUID();
      const photoId = `integration-${workspaceId}`;
      const albumId = randomUUID();
      await db`INSERT INTO users (id, email) VALUES (${userId}, ${`${workspaceId}@example.test`})`;
      await db`INSERT INTO workspaces (id, slug, name) VALUES (${workspaceId}, ${`integration-${workspaceId}`}, 'Integration')`;
      await db`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${workspaceId}, ${userId}, 'owner')`;
      await db`INSERT INTO locations (id, workspace_id, display_name) VALUES (${locationId}, ${workspaceId}, 'Test place')`;
      await db`INSERT INTO photos (id, workspace_id, checksum, location_id) VALUES (${photoId}, ${workspaceId}, 'duplicate-checksum', ${locationId})`;
      await db.unsafe('SAVEPOINT duplicate_photo');
      await expect(db`INSERT INTO photos (id, workspace_id, checksum) VALUES (${`${photoId}-2`}, ${workspaceId}, 'duplicate-checksum')`).rejects.toThrow();
      await db.unsafe('ROLLBACK TO SAVEPOINT duplicate_photo');
      await db`INSERT INTO photo_files (photo_id, kind, storage_key, checksum, width, height, format, byte_size) VALUES (${photoId}, 'original', ${`${photoId}/original.jpg`}, 'duplicate-checksum', 10, 10, 'jpeg', 100)`;
      await db`INSERT INTO albums (id, workspace_id, title, shoot_date, cover_photo_id) VALUES (${albumId}, ${workspaceId}, 'Test', '2026-01-02', ${photoId})`;
      await db`INSERT INTO album_photos (album_id, photo_id) VALUES (${albumId}, ${photoId})`;
      await db`INSERT INTO import_batches (id, workspace_id, actor_id) VALUES (${batchId}, ${workspaceId}, ${userId})`;
      await db`INSERT INTO import_items (batch_id, source_key) VALUES (${batchId}, 'test.jpg')`;
      await db`INSERT INTO audit_logs (workspace_id, actor_id, action, entity_type, entity_id) VALUES (${workspaceId}, ${userId}, 'create', 'photo', ${photoId})`;
      await db`DELETE FROM workspaces WHERE id = ${workspaceId}`;
      const scopedTables: Record<string, string> = {
        memberships: `workspace_id = '${workspaceId}'`, photos: `workspace_id = '${workspaceId}'`,
        photo_files: `photo_id = '${photoId}'`, albums: `workspace_id = '${workspaceId}'`,
        album_photos: `album_id = '${albumId}'`,
        locations: `workspace_id = '${workspaceId}'`, import_batches: `workspace_id = '${workspaceId}'`,
        import_items: `batch_id = '${batchId}'`, audit_logs: `workspace_id = '${workspaceId}'`,
      };
      for (const [table, predicate] of Object.entries(scopedTables)) {
        const rows = await db.unsafe(`SELECT count(*)::int AS count FROM ${table} WHERE ${predicate}`);
        expect(rows[0]?.count).toBe(0);
      }
    } finally {
      await db.unsafe('ROLLBACK').catch(() => undefined);
      await db.end();
    }
  }, 30_000);
});
