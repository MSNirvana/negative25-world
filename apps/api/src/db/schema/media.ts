import { boolean, bigint, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { photos } from './photos.js';

export const photoFiles = pgTable('photo_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  photoId: text('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  storageKey: text('storage_key').notNull().unique(),
  checksum: text('checksum').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  format: text('format').notNull(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  isPrivate: boolean('is_private').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('photo_files_variant_unique').on(table.photoId, table.kind, table.width, table.height, table.format)]);
