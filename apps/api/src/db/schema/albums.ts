import { date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { photos } from './photos.js';
import { workspaces } from './workspaces.js';

export const albums = pgTable('albums', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  shootDate: date('shoot_date', { mode: 'string' }),
  coverPhotoId: text('cover_photo_id').references(() => photos.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
