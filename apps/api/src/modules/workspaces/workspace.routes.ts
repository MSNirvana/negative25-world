import type { FastifyInstance } from 'fastify';
import { WorkspaceService } from './workspace.service.js';
import { AuthService } from '../auth/auth.service.js';
import { getBearer } from '../auth/auth.routes.js';
import { CHINA_REGION_DEFINITIONS, locationMatchesRegion, normalizeLocationText } from '@negative25/contracts';
import { ApiError } from '@negative25/utils';
import { isPhotoPublic } from '../../db/repository.js';

export function registerWorkspaceRoutes(app: FastifyInstance, workspaces: WorkspaceService, auth: AuthService): void {
  app.get('/api/v1/workspaces', async (request) => {
    const user = await auth.authenticate(getBearer(request.headers.authorization));
    return workspaces.listForUser(user.id);
  });
  app.get('/api/v1/spaces/:slug', async (request) => {
    const workspace = await workspaces.getBySlug((request.params as { slug: string }).slug);
    return workspace;
  });
  app.get('/api/v1/spaces/:slug/photos', async (request) => {
    const { slug } = request.params as { slug: string };
    const token = request.headers.authorization;
    if (slug !== 'primary' && !token) await workspaces.getPublicBySlug(slug);
    else if (slug !== 'primary' && token) await workspaces.requireWorkspaceRole(slug, (await auth.authenticate(getBearer(token))).id);
    const query = request.query as { mode?: string; cursor?: string; limit?: string; location?: string };
    const modes = ['featured', 'recent', 'shuffle', 'location', 'nearby', 'faraway'];
    if (query.mode && !modes.includes(query.mode)) throw new ApiError('VALIDATION_ERROR', 'Unsupported gallery mode');
    const workspace = await workspaces.getBySlug(slug);
    const photos = (await workspaces.listPhotos(workspace.id)).filter(isPhotoPublic);
    const requestedLimit = Number(query.limit ?? 24);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new ApiError('VALIDATION_ERROR', 'Invalid limit');
    const limit = Math.min(100, requestedLimit);
    const start = query.cursor ? Number(query.cursor) : 0;
    if (!Number.isInteger(start) || start < 0 || (query.cursor && !/^\d+$/.test(query.cursor))) throw new ApiError('VALIDATION_ERROR', 'Invalid cursor');
    const filteredPhotos = query.location?.trim() ? filterPhotosByLocation(photos, query.location.trim()) : photos;
    const items = sortPhotos(filteredPhotos, query.mode).slice(start, start + limit);
    return { photos: items, pagination: { nextCursor: start + limit < filteredPhotos.length ? String(start + limit) : null, hasMore: start + limit < filteredPhotos.length } };
  });
  app.get('/api/v1/photos/:id', async (request) => {
    const { id } = request.params as { id: string };
    const workspace = await workspaces.getBySlug('primary');
    const photo = await workspaces.findPhoto(workspace.id, id);
    if (!photo || !isPhotoPublic(photo)) throw new ApiError('NOT_FOUND', 'Photo not found');
    return photo;
  });
  app.get('/api/v1/spaces/:slug/photos/:id', async (request) => {
    const { slug, id } = request.params as { slug: string; id: string };
    const workspace = request.headers.authorization
      ? await workspaces.requireWorkspaceRole(slug, (await auth.authenticate(getBearer(request.headers.authorization))).id)
      : await workspaces.getPublicBySlug(slug);
    const photo = await workspaces.findPhoto(workspace.id, id);
    if (!photo || !isPhotoPublic(photo)) throw new ApiError('NOT_FOUND', 'Photo not found');
    return photo;
  });
}

function sortPhotos<T extends { id: string; rating: number | null; capturedAt?: string }>(photos: T[], mode?: string): T[] {
  const sorted = [...photos];
  if (mode === 'recent') return sorted.sort((a, b) => String(b.capturedAt ?? '').localeCompare(String(a.capturedAt ?? '')));
  if (mode === 'featured') return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.id.localeCompare(b.id));
  if (mode === 'shuffle') return sorted.sort((a, b) => stableHash(a.id) - stableHash(b.id));
  return sorted;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function filterPhotosByLocation<T extends { location?: { id: string; name: string } | null; metadata?: Record<string, unknown> }>(photos: T[], query: string): T[] {
  const normalizedQuery = normalizeLocationText(query);
  const region = CHINA_REGION_DEFINITIONS.find((item) => normalizeLocationText(item.id) === normalizedQuery || locationMatchesRegion(query, item));
  const querySlug = slugifyLocation(query);
  return photos.filter((photo) => {
    const candidates = [photo.location?.name, photo.location?.id, typeof photo.metadata?.locationName === 'string' ? photo.metadata.locationName : undefined].filter((value): value is string => Boolean(value));
    if (region) return candidates.some((value) => locationMatchesRegion(value, region));
    return candidates.some((value) => normalizeLocationText(value).includes(normalizedQuery) || slugifyLocation(value).includes(querySlug));
  });
}

function slugifyLocation(value: string): string {
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'unknown-location';
}
const publicPhotos = [
  { id: 'primary-photo-1', spaceSlug: 'primary', title: 'negative25', capturedAt: '2026-01-02T03:04:05.000Z', aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://cdn.invalid/primary-photo-1.jpg', width: 300, height: 200, format: 'jpeg' }, media: [], location: null, metadata: {}, published: true, hidden: false },
];
