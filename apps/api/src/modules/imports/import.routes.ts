import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/auth.service.js';
import { getBearer } from '../auth/auth.routes.js';
import type { WorkspaceService } from '../workspaces/workspace.service.js';
import { ImportService, type ImportActor } from './import.service.js';

const createRequest = z.object({ spaceSlug: z.string().min(1), sourceKeys: z.array(z.string().min(1)).min(1).max(10_000), idempotencyKey: z.string().min(1).max(200).optional() });
async function actorFor(request: { headers: { authorization?: string } }, slug: string, auth: AuthService, workspaces: WorkspaceService, roles: ImportActor['role'][] = ['owner', 'admin', 'editor']): Promise<ImportActor> {
  const user = await auth.authenticate(getBearer(request.headers.authorization));
  const workspace = await workspaces.requireWorkspaceRole(slug, user.id, roles);
  const membership = await workspaces.getMembership(workspace.id, user.id);
  if (!membership) throw new Error('Workspace membership missing');
  return { userId: user.id, workspaceId: workspace.id, role: membership.role };
}

export function registerImportRoutes(app: FastifyInstance, imports: ImportService, auth: AuthService, workspaces: WorkspaceService): void {
  app.post('/api/v1/imports', async (request) => {
    const body = createRequest.parse(request.body);
    return imports.createBatch(await actorFor(request, body.spaceSlug, auth, workspaces), body.sourceKeys, body.idempotencyKey);
  });
  app.post('/api/v1/spaces/:slug/imports', async (request) => {
    const params = request.params as { slug: string };
    const body = createRequest.omit({ spaceSlug: true }).parse(request.body);
    return imports.createBatch(await actorFor(request, params.slug, auth, workspaces), body.sourceKeys, body.idempotencyKey);
  });
  app.get('/api/v1/spaces/:slug/imports', async (request) => {
    const { slug } = request.params as { slug: string };
    return imports.listBatches(await actorFor(request, slug, auth, workspaces, ['owner', 'admin', 'editor', 'viewer']));
  });
  for (const [action, handler] of [['preview', (service: ImportService, actor: ImportActor, id: string) => service.preview(actor, id)], ['confirm', (service: ImportService, actor: ImportActor, id: string) => service.confirm(actor, id)], ['cancel', (service: ImportService, actor: ImportActor, id: string) => service.cancel(actor, id)], ['retry', (service: ImportService, actor: ImportActor, id: string) => service.retryFailed(actor, id)]] as const) {
    app.post(`/api/v1/imports/:id/${action}`, async (request) => { const { id } = request.params as { id: string }; return handler(imports, await actorFor(request, 'primary', auth, workspaces), id); });
    app.post(`/api/v1/spaces/:slug/imports/:id/${action}`, async (request) => { const { slug, id } = request.params as { slug: string; id: string }; return handler(imports, await actorFor(request, slug, auth, workspaces), id); });
  }
  app.post('/api/v1/imports/:id/publish', async (request) => { const { id } = request.params as { id: string }; return imports.publish(await actorFor(request, 'primary', auth, workspaces), id); });
  app.post('/api/v1/spaces/:slug/imports/:id/publish', async (request) => { const { slug, id } = request.params as { slug: string; id: string }; return imports.publish(await actorFor(request, slug, auth, workspaces), id); });
  app.get('/api/v1/imports/:id', async (request) => { const { id } = request.params as { id: string }; return imports.getBatch(await actorFor(request, 'primary', auth, workspaces, ['owner', 'admin', 'editor', 'viewer']), id); });
  app.get('/api/v1/spaces/:slug/imports/:id', async (request) => { const { slug, id } = request.params as { slug: string; id: string }; return imports.getBatch(await actorFor(request, slug, auth, workspaces, ['owner', 'admin', 'editor', 'viewer']), id); });
}
