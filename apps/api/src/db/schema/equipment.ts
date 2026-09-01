import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces.js';

export const equipment = pgTable('equipment', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('equipment_workspace_kind_name_unique').on(table.workspaceId, table.kind, table.name)]);
