import { boolean, check, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { locations } from './locations.js';

export const photos = pgTable('photos', {
  id: text('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  checksum: text('checksum').notNull(),
  status: text('status').notNull().default('draft'),
  title: text('title').notNull().default(''),
  description: text('description'),
  metadata: jsonb('metadata').notNull().default({}),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  capturedAtLocal: text('captured_at_local'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  rating: integer('rating'),
  sortOrder: integer('sort_order').notNull().default(0),
  hidden: boolean('hidden').notNull().default(false),
  published: boolean('published').notNull().default(false),
  allowDownload: boolean('allow_download').notNull().default(false),
  protectedPreview: boolean('protected_preview').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('photos_workspace_checksum_unique').on(table.workspaceId, table.checksum),
  check('photos_rating_check', sql`${table.rating} IS NULL OR ${table.rating} BETWEEN 0 AND 7`),
]);
