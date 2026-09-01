import { boolean, text, timestamp, uuid, pgTable } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  avatarMediaId: text('avatar_media_id'),
  displayName: text('display_name'),
  bio: text('bio'),
  location: text('location'),
  websiteUrl: text('website_url'),
  instagramUrl: text('instagram_url'),
  weiboUrl: text('weibo_url'),
  profilePublic: boolean('profile_public').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
