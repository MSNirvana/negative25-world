import { z } from 'zod';

export const GalleryModeSchema = z.enum(['featured', 'recent', 'shuffle', 'location', 'nearby', 'faraway']);
export type GalleryMode = z.infer<typeof GalleryModeSchema>;

export const CursorQuerySchema = z.object({
  cursor: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

export const PaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});
export const ApiErrorResponseSchema = z.object({ error: ApiErrorSchema, requestId: z.string().min(1) });
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const IdSchema = z.string().min(1);
