import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '@negative25/utils';
import { getBearer } from '../auth/auth.routes.js';
import type { AuthService } from '../auth/auth.service.js';
import type { WorkspaceService } from '../workspaces/workspace.service.js';
import { MediaService, type MediaActor } from './media.service.js';

const uploadRequest = z.object({ spaceSlug: z.string().min(1), filename: z.string().min(1), contentType: z.string().min(1), byteSize: z.number().int().positive() });
const completeRequest = z.object({ spaceSlug: z.string().min(1), key: z.string().min(1), expectedByteSize: z.number().int().positive(), expectedContentType: z.string().min(1), checksum: z.string().length(64).optional() });
const multipartInitiateRequest = uploadRequest.extend({ checksum: z.string().length(64).optional() });
const multipartPartRequest = z.object({ spaceSlug: z.string().min(1), partNumber: z.number().int().positive() });
const multipartCompleteRequest = z.object({ parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1).max(512) })).min(1) });

async function actorFor(request: { headers: { authorization?: string } }, slug: string, auth: AuthService, workspaces: WorkspaceService): Promise<MediaActor> {
  const user = await auth.authenticate(getBearer(request.headers.authorization));
  const workspace = await workspaces.requireWorkspaceRole(slug, user.id, ['owner', 'admin', 'editor']);
  const membership = await workspaces.getMembership(workspace.id, user.id);
  if (!membership) throw new ApiError('FORBIDDEN', 'Workspace access denied');
  return { userId: user.id, workspaceId: workspace.id, role: membership.role };
}

export function registerMediaRoutes(app: FastifyInstance, media: MediaService, auth: AuthService, workspaces: WorkspaceService): void {
  app.post('/api/v1/media/upload-url', async (request) => {
    const body = uploadRequest.parse(request.body);
    const actor = await actorFor(request, body.spaceSlug, auth, workspaces);
    const result = await media.createUploadUrl(actor, body);
    return result;
  });
  app.post('/api/v1/media/multipart/initiate', async (request) => {
    const body = multipartInitiateRequest.parse(request.body);
    const actor = await actorFor(request, body.spaceSlug, auth, workspaces);
    return media.initiateMultipart(actor, body);
  });
  app.post('/api/v1/media/multipart/:id/part-url', async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = multipartPartRequest.parse(request.body);
    const actor = await actorFor(request, body.spaceSlug, auth, workspaces);
    return { url: await media.createMultipartPartUrl(actor, params.id, body.partNumber), expiresIn: 900 };
  });
  app.get('/api/v1/media/multipart/:id/status', async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = z.object({ spaceSlug: z.string().min(1) }).parse(request.query);
    const actor = await actorFor(request, query.spaceSlug, auth, workspaces);
    return media.getMultipartStatus(actor, params.id);
  });
  app.post('/api/v1/media/multipart/:id/complete', async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ spaceSlug: z.string().min(1), parts: multipartCompleteRequest.shape.parts }).parse(request.body);
    const actor = await actorFor(request, body.spaceSlug, auth, workspaces);
    return media.completeMultipart(actor, params.id, body.parts);
  });
  app.post('/api/v1/media/multipart/:id/abort', async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ spaceSlug: z.string().min(1) }).parse(request.body);
    const actor = await actorFor(request, body.spaceSlug, auth, workspaces);
    await media.abortMultipart(actor, params.id);
    return { ok: true };
  });
  app.post('/api/v1/media/upload-content', async (request) => {
    const header = (name: string): string => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] ?? '' : value ?? '';
    };
    const spaceSlug = header('x-space-slug');
    const key = header('x-upload-key');
    const expectedContentType = header('x-expected-content-type') || header('content-type').split(';')[0];
    const expectedByteSize = Number(header('x-expected-byte-size'));
    if (!spaceSlug || !key || !expectedContentType || !Number.isSafeInteger(expectedByteSize)) throw new ApiError('VALIDATION_ERROR', 'Upload metadata is required');
    const body = request.body;
    if (!(body instanceof Uint8Array)) throw new ApiError('VALIDATION_ERROR', 'Binary upload body is required');
    const actor = await actorFor(request, spaceSlug, auth, workspaces);
    const completed = await media.uploadContent(actor, { key, expectedByteSize, expectedContentType, body });
    return { key: completed.sourceKey, byteSize: completed.byteSize };
  });
  app.post('/api/v1/media/complete', async (request) => {
    const body = completeRequest.parse(request.body);
    const actor = await actorFor(request, body.spaceSlug, auth, workspaces);
    return media.completeUpload(actor, body);
  });
}
