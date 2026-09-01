import type { FastifyInstance } from 'fastify';
import { AuthService } from './modules/auth/auth.service.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { WorkspaceService } from './modules/workspaces/workspace.service.js';
import { registerWorkspaceRoutes } from './modules/workspaces/workspace.routes.js';
import { MediaService } from './modules/media/media.service.js';
import { MemoryStorageAdapter, S3StorageAdapter, type StorageAdapter } from './modules/media/storage.js';
import { registerMediaRoutes } from './modules/media/media.routes.js';
import { ImportService } from './modules/imports/import.service.js';
import { registerImportRoutes } from './modules/imports/import.routes.js';
import { createImportPublisher, shouldEnableImportQueue } from './modules/imports/import-queue.js';
import { LocationService } from './modules/locations/location.service.js';
import { registerLocationRoutes } from './modules/locations/location.routes.js';
import { AdminService } from './modules/admin/admin.service.js';
import { registerAdminRoutes } from './modules/admin/admin.routes.js';
import { AlbumService } from './modules/albums/album.service.js';
import { registerAlbumRoutes } from './modules/albums/album.routes.js';
import { registerHealthRoutes } from './modules/health/health.routes.js';
import { fetchElevation } from '@negative25/utils';
import { createRepository, OTHER_WORKSPACE_ID, PRIMARY_WORKSPACE_ID } from './db/repository.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const { repository, close } = createRepository();
  app.addHook('onClose', async () => close());
  // Tests stay in-process; production enables the queue unless explicitly disabled.
  const publisher = shouldEnableImportQueue() ? createImportPublisher() : undefined;
  app.addHook('onClose', async () => publisher?.close?.());
  const auth = new AuthService(repository);
  const owner = await auth.seed();
  const workspaces = new WorkspaceService(repository);
  const elevationLookup = process.env.NODE_ENV === 'test' ? undefined : (coordinate: Parameters<typeof fetchElevation>[0]) => fetchElevation(coordinate, process.env.N25_ELEVATION_API_URL);
  const admin = new AdminService(repository, elevationLookup);
  const primaryWorkspace = await repository.saveWorkspace({ id: PRIMARY_WORKSPACE_ID, slug: 'primary', name: 'negative25' });
  await repository.saveWorkspace({ id: OTHER_WORKSPACE_ID, slug: 'other', name: 'Field notes' });
  await repository.saveMembership({ workspaceId: primaryWorkspace.id, userId: owner.id, role: 'owner' });
  registerAuthRoutes(app, auth);
  registerWorkspaceRoutes(app, workspaces, auth);
  registerMediaRoutes(app, new MediaService(createStorageAdapter()), auth, workspaces);
  registerImportRoutes(app, new ImportService(repository, publisher), auth, workspaces);
  registerAlbumRoutes(app, new AlbumService(repository), auth, workspaces);
  registerLocationRoutes(app, new LocationService(), workspaces, auth);
  registerAdminRoutes(app, admin, auth, workspaces);
  registerHealthRoutes(app);
}

function createStorageAdapter(): StorageAdapter {
  const { S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL } = process.env;
  if (S3_ENDPOINT && S3_BUCKET && S3_REGION && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    return new S3StorageAdapter({
      endpoint: S3_ENDPOINT,
      bucket: S3_BUCKET,
      region: S3_REGION,
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
      publicBaseUrl: S3_PUBLIC_BASE_URL,
    });
  }
  return new MemoryStorageAdapter();
}
