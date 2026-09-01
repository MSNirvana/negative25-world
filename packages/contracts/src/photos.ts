import { z } from 'zod';
import { IdSchema } from './common.js';

export const MediaVariantSchema = z.object({
  kind: z.enum(['original', 'thumbnail', 'preview', 'large']),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1),
});
export const PhotoLocationSchema = z.object({ id: IdSchema, name: z.string() }).nullable();
export const PhotoSummarySchema = z.object({
  id: IdSchema,
  spaceSlug: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  capturedAt: z.string().datetime({ offset: true }),
  rating: z.number().int().min(0).max(7).nullable().default(null),
  aspectRatio: z.number().positive(),
  thumbnail: MediaVariantSchema,
  media: z.array(MediaVariantSchema).default([]),
  location: PhotoLocationSchema,
  metadata: z.record(z.unknown()),
});
export type PhotoSummary = z.infer<typeof PhotoSummarySchema>;
export const PhotoListResponseSchema = z.object({ photos: z.array(PhotoSummarySchema), pagination: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }) });
