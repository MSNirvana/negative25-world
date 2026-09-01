import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('memberships_workspace_user_unique').on(table.workspaceId, table.userId),
  check('memberships_role_check', sql`${table.role} IN ('owner', 'admin', 'editor', 'viewer')`),
]);
