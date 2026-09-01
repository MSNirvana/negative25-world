import { bigint, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const mediaUploads = pgTable('media_uploads', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  storageUploadId: text('storage_upload_id').notNull().unique(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  checksum: text('checksum'),
  partSize: integer('part_size').notNull(),
  partCount: integer('part_count').notNull(),
  status: text('status').notNull().default('initiated'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
