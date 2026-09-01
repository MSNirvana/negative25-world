import { jsonb, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const importBatches = pgTable('import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('uploaded'),
  idempotencyKey: text('idempotency_key'),
  totalCount: integer('total_count').notNull().default(0),
  completedCount: integer('completed_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const importItems = pgTable('import_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').notNull().references(() => importBatches.id, { onDelete: 'cascade' }),
  sourceKey: text('source_key').notNull(),
  status: text('status').notNull().default('uploaded'),
  checksum: text('checksum'),
  errors: jsonb('errors').notNull().default([]),
  warnings: jsonb('warnings').notNull().default([]),
  resolvedFields: jsonb('resolved_fields').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('import_items_batch_source_unique').on(table.batchId, table.sourceKey)]);
