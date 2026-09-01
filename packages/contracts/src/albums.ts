import { z } from 'zod';
import { IdSchema } from './common.js';
import { PhotoSummarySchema } from './photos.js';

export const AlbumSummarySchema = z.object({
  id: IdSchema,
  spaceSlug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  shootDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cover: PhotoSummarySchema.nullable(),
  photoCount: z.number().int().nonnegative(),
});
export type AlbumSummary = z.infer<typeof AlbumSummarySchema>;

export const AlbumDetailSchema = AlbumSummarySchema.extend({ photos: z.array(PhotoSummarySchema) });
export type AlbumDetail = z.infer<typeof AlbumDetailSchema>;

export const AdminAlbumSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  shootDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  coverPhotoId: IdSchema.nullable(),
  photoIds: z.array(IdSchema),
  photoCount: z.number().int().nonnegative(),
});
export type AdminAlbum = z.infer<typeof AdminAlbumSchema>;
