import { z } from 'zod';
import { MemberRoleSchema } from '@negative25/contracts';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/auth.service.js';
import { getBearer } from '../auth/auth.routes.js';
import type { WorkspaceService } from '../workspaces/workspace.service.js';
import { AdminService, type AdminActor } from './admin.service.js';

const locationPatch = z.object({ name: z.string().trim().max(240), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), displayAddress: z.string().trim().max(240).optional(), displayRegion: z.string().trim().max(120).optional(), displayRegionEnabled: z.boolean().optional() });
const patchRequest = z.object({ title: z.string().max(240).optional(), description: z.string().max(5000).optional(), published: z.boolean().optional(), hidden: z.boolean().optional(), ownerOnly: z.boolean().optional(), rating: z.number().int().min(0).max(7).nullable().optional(), location: locationPatch.nullable().optional() });
const patchMemberRequest = z.object({ role: MemberRoleSchema });
async function actorFor(request: { headers: { authorization?: string } }, slug: string, auth: AuthService, workspaces: WorkspaceService): Promise<AdminActor> { const user = await auth.authenticate(getBearer(request.headers.authorization)); const workspace = await workspaces.requireWorkspaceRole(slug, user.id); const membership = await workspaces.getMembership(workspace.id, user.id); if (!membership) throw new Error('Workspace membership missing'); return { userId: user.id, workspaceId: workspace.id, role: membership.role }; }

export function registerAdminRoutes(app: FastifyInstance, admin: AdminService, auth: AuthService, workspaces: WorkspaceService): void {
  app.get('/api/v1/admin/spaces/:slug/summary', async (request) => {
    const slug = (request.params as { slug: string }).slug;
    const actor = await actorFor(request, slug, auth, workspaces);
    const workspace = await workspaces.getBySlug(slug);
    const summary = await admin.summary(actor);
    return { workspace: { ...workspace, role: actor.role }, stats: { photoCount: summary.photoCount, publishedPhotoCount: summary.publishedPhotoCount, pendingImportCount: summary.pendingImportCount }, recentActivity: summary.recentActivity };
  });
  app.get('/api/v1/admin/spaces/:slug/photos', async (request) => admin.listPhotos(await actorFor(request, (request.params as { slug: string }).slug, auth, workspaces)));
  app.patch('/api/v1/admin/spaces/:slug/photos/:id', async (request) => { const params = request.params as { slug: string; id: string }; return admin.patchPhoto(await actorFor(request, params.slug, auth, workspaces), params.id, patchRequest.parse(request.body)); });
  app.get('/api/v1/admin/spaces/:slug/members', async (request) => admin.members(await actorFor(request, (request.params as { slug: string }).slug, auth, workspaces)));
  app.patch('/api/v1/admin/spaces/:slug/members/:userId', async (request) => { const params = request.params as { slug: string; userId: string }; return admin.patchMember(await actorFor(request, params.slug, auth, workspaces), params.userId, patchMemberRequest.parse(request.body).role); });
}
