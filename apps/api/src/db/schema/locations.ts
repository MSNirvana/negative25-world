import { numeric, pgTable, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces.js';

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => locations.id, { onDelete: 'set null' }),
  displayName: text('display_name').notNull(),
  localizedName: text('localized_name'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  accuracy: numeric('accuracy'),
  timezone: text('timezone'),
  alias: text('alias'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
