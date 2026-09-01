import { z } from 'zod';

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

export const DiscoverLocationSchema = LocationSchema.extend({
  alias: z.string().optional(),
  photoIds: z.array(z.string()).default([]),
});
export const DiscoverLocationsResponseSchema = z.object({ locations: z.array(DiscoverLocationSchema) });
export type DiscoverLocationRecord = z.infer<typeof DiscoverLocationSchema>;
