import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '@negative25/utils';
import type { LocationService } from './location.service.js';
import type { WorkspaceService } from '../workspaces/workspace.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { getBearer } from '../auth/auth.routes.js';
import { isPhotoPublic } from '../../db/repository.js';

const coordinateQuery = z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), limit: z.coerce.number().int().min(1).max(100).default(24) });
export function registerLocationRoutes(app: FastifyInstance, locations: LocationService, workspaces?: WorkspaceService, auth?: AuthService): void {
  app.get('/api/v1/discover/locations', async (request) => {
    const query = request.query as { q?: string; spaceSlug?: string };
    if (!query.spaceSlug || !workspaces || !auth) return { locations: locations.list(query.q) };
    const workspace = query.spaceSlug === 'primary'
      ? await workspaces.getBySlug('primary')
      : request.headers.authorization
        ? await workspaces.requireWorkspaceRole(query.spaceSlug, (await auth.authenticate(getBearer(request.headers.authorization))).id)
        : await workspaces.getPublicBySlug(query.spaceSlug);
    return { locations: locationsFromPhotos(await workspaces.listPhotos(workspace.id), query.q) };
  });
  app.get('/api/v1/discover/locations/:id/photos', async (request) => ({ locationId: (request.params as { id: string }).id, photoIds: locations.photosFor((request.params as { id: string }).id) }));
  app.get('/api/v1/discover/nearby', async (request) => { const query = coordinateQuery.safeParse(request.query); if (!query.success) throw new ApiError('VALIDATION_ERROR', 'Invalid coordinates', query.error.flatten()); return { locations: locations.nearby(query.data, query.data.limit) }; });
  app.get('/api/v1/discover/faraway', async (request) => { const query = coordinateQuery.safeParse(request.query); if (!query.success) throw new ApiError('VALIDATION_ERROR', 'Invalid coordinates', query.error.flatten()); return { locations: locations.faraway(query.data, query.data.limit) }; });
}

function locationsFromPhotos(photos: Array<{ id: string; published: boolean; hidden: boolean; ownerOnly?: boolean; location?: { id: string; name: string } | null; latitude?: number; longitude?: number; metadata?: Record<string, unknown> }>, query?: string) {
  const grouped = new Map<string, { id: string; name: string; latitude: number | null; longitude: number | null; photoIds: string[] }>();
  for (const photo of photos) {
    if (!isPhotoPublic(photo)) continue;
    const latitude = coordinate(photo.latitude ?? photo.metadata?.latitude, -90, 90);
    const longitude = coordinate(photo.longitude ?? photo.metadata?.longitude, -180, 180);
    if (latitude == null || longitude == null) continue;
    const name = photo.location?.name ?? stringValue(photo.metadata?.locationName) ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    const id = photo.location?.id ?? `coordinates-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
    const value = grouped.get(id) ?? { id, name, latitude, longitude, photoIds: [] };
    value.photoIds.push(photo.id);
    grouped.set(id, value);
  }
  const needle = query?.trim().toLowerCase();
  return [...grouped.values()].filter((item) => !needle || item.name.toLowerCase().includes(needle));
}

function coordinate(value: unknown, minimum: number, maximum: number): number | null { const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN; return Number.isFinite(result) && result >= minimum && result <= maximum ? result : null; }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
