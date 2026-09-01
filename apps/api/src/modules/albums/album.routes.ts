import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '@negative25/utils';
import type { AuthService } from '../auth/auth.service.js';
import { getBearer } from '../auth/auth.routes.js';
import type { WorkspaceService } from '../workspaces/workspace.service.js';
import { AlbumService, type AlbumActor } from './album.service.js';

const shootDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Shoot date must use YYYY-MM-DD').refine(isValidDateOnly, 'Shoot date must be a real calendar date').nullable().optional();
const createRequest = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), shootDate, coverPhotoId: z.string().min(1).nullable().optional(), photoIds: z.array(z.string().min(1)).max(500).optional(), sortOrder: z.number().int().min(-100000).max(100000).optional() });
const patchRequest = createRequest.partial();

async function actorFor(request: { headers: { authorization?: string } }, slugValue: string, auth: AuthService, workspaces: WorkspaceService): Promise<AlbumActor> {
  const user = await auth.authenticate(getBearer(request.headers.authorization));
  const workspace = await workspaces.requireWorkspaceRole(slugValue, user.id);
  const membership = await workspaces.getMembership(workspace.id, user.id);
  if (!membership) throw new ApiError('FORBIDDEN', 'Workspace access denied');
  return { userId: user.id, workspaceId: workspace.id, role: membership.role };
}

async function publicWorkspace(request: { headers: { authorization?: string } }, slugValue: string, auth: AuthService, workspaces: WorkspaceService): Promise<string> {
  const workspace = await workspaces.getBySlug(slugValue);
  if (slugValue !== 'primary') {
    if (request.headers.authorization) {
      const user = await auth.authenticate(getBearer(request.headers.authorization));
      await workspaces.requireWorkspaceRole(slugValue, user.id);
    } else {
      await workspaces.getPublicBySlug(slugValue);
    }
  }
  return workspace.id;
}

export function registerAlbumRoutes(app: FastifyInstance, albums: AlbumService, auth: AuthService, workspaces: WorkspaceService): void {
  app.get('/api/v1/spaces/:slug/albums', async (request) => {
    const spaceSlug = (request.params as { slug: string }).slug;
    return { albums: await albums.listPublic(await publicWorkspace(request, spaceSlug, auth, workspaces)) };
  });
  app.get('/api/v1/spaces/:slug/albums/:albumId', async (request) => {
    const params = request.params as { slug: string; albumId: string };
    return albums.getPublic(await publicWorkspace(request, params.slug, auth, workspaces), params.albumId);
  });
  app.get('/api/v1/admin/spaces/:slug/albums', async (request) => albums.listAdmin(await actorFor(request, (request.params as { slug: string }).slug, auth, workspaces)));
  app.post('/api/v1/admin/spaces/:slug/albums', async (request) => {
    const params = request.params as { slug: string };
    return albums.create(await actorFor(request, params.slug, auth, workspaces), createRequest.parse(request.body));
  });
  app.patch('/api/v1/admin/spaces/:slug/albums/:id', async (request) => {
    const params = request.params as { slug: string; id: string };
    return albums.update(await actorFor(request, params.slug, auth, workspaces), params.id, patchRequest.parse(request.body));
  });
  app.delete('/api/v1/admin/spaces/:slug/albums/:id', async (request, reply) => {
    const params = request.params as { slug: string; id: string };
    await albums.remove(await actorFor(request, params.slug, auth, workspaces), params.id);
    return reply.code(204).send();
  });
}

function isValidDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
