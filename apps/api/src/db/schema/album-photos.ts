import { integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { albums } from './albums.js';
import { photos } from './photos.js';

export const albumPhotos = pgTable('album_photos', {
  albumId: uuid('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),
  photoId: text('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [primaryKey({ columns: [table.albumId, table.photoId] })]);
