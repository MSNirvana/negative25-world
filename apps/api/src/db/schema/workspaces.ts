import { boolean, text, timestamp, uuid, pgTable } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  locale: text('locale').notNull().default('en'),
  kind: text('kind').notNull().default('collaborative'),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  isPublic: boolean('is_public').notNull().default(false),
  allowMemberShowcase: boolean('allow_member_showcase').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
