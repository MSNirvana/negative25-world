import { describe, expect, it, vi } from 'vitest';
import { MemoryRepository, PRIMARY_WORKSPACE_ID } from '../../db/repository.js';
import { AdminService } from './admin.service.js';
import type { StorageAdapter } from '../media/storage.js';

describe('AdminService elevation persistence', () => {
  it('stores display address settings alongside the standard location', async () => {
    const repository = new MemoryRepository();
    const service = new AdminService(repository);
    const actor = { userId: 'owner', workspaceId: PRIMARY_WORKSPACE_ID, role: 'owner' as const };

    const updated = await service.patchPhoto(actor, 'primary-photo-1', {
      location: { name: '永济市鹳雀楼景区', latitude: 34.829, longitude: 110.669, displayAddress: '鹳雀楼', displayRegion: '山西省', displayRegionEnabled: true },
    });

    expect(updated.location).toMatchObject({ name: '永济市鹳雀楼景区' });
    expect(updated.metadata).toMatchObject({ displayAddress: '鹳雀楼', displayRegion: '山西省', displayRegionEnabled: true, latitude: 34.829, longitude: 110.669 });
  });

  it('clears display address settings when a location is cleared', async () => {
    const repository = new MemoryRepository();
    const service = new AdminService(repository);
    const actor = { userId: 'owner', workspaceId: PRIMARY_WORKSPACE_ID, role: 'owner' as const };

    await service.patchPhoto(actor, 'primary-photo-1', {
      location: { name: '永济市鹳雀楼景区', latitude: 34.829, longitude: 110.669, displayAddress: '鹳雀楼', displayRegion: '山西省', displayRegionEnabled: true },
    });
    const updated = await service.patchPhoto(actor, 'primary-photo-1', { location: null });

    expect(updated.location).toBeNull();
    expect(updated.metadata).not.toHaveProperty('displayAddress');
    expect(updated.metadata).not.toHaveProperty('displayRegion');
    expect(updated.metadata).not.toHaveProperty('displayRegionEnabled');
  });

  it('looks up and stores altitude when a location is assigned', async () => {
    const repository = new MemoryRepository();
    const lookupElevation = vi.fn().mockResolvedValue(88.2);
    const service = new AdminService(repository, lookupElevation);
    const actor = { userId: 'owner', workspaceId: PRIMARY_WORKSPACE_ID, role: 'owner' as const };

    const updated = await service.patchPhoto(actor, 'primary-photo-1', { location: { name: '北京故宫', latitude: 39.9163, longitude: 116.3972 } });

    expect(lookupElevation).toHaveBeenCalledWith({ latitude: 39.9163, longitude: 116.3972 });
    expect(updated.metadata).toMatchObject({ altitude: 88.2, latitude: 39.9163, longitude: 116.3972 });
  });

  it('keeps a stored altitude when the same location is saved again', async () => {
    const repository = new MemoryRepository();
    const lookupElevation = vi.fn().mockResolvedValue(88.2);
    const service = new AdminService(repository, lookupElevation);
    const actor = { userId: 'owner', workspaceId: PRIMARY_WORKSPACE_ID, role: 'owner' as const };

    await service.patchPhoto(actor, 'primary-photo-1', { location: { name: '北京故宫', latitude: 39.9163, longitude: 116.3972 } });
    lookupElevation.mockClear();
    const updated = await service.patchPhoto(actor, 'primary-photo-1', { location: { name: '北京故宫', latitude: 39.9163, longitude: 116.3972 } });

    expect(lookupElevation).not.toHaveBeenCalled();
    expect(updated.metadata).toMatchObject({ altitude: 88.2 });
  });
});

describe('AdminService photo management', () => {
  const actor = { userId: 'owner', workspaceId: PRIMARY_WORKSPACE_ID, role: 'owner' as const };

  it('copies only the selected metadata fields from the first photo', async () => {
    const repository = new MemoryRepository();
    await repository.savePhoto({ id: 'source-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Source', description: '', published: true, hidden: false, rating: 7, latitude: 39.9, longitude: 116.4, location: { id: 'source-location', name: '北京故宫' }, metadata: { displayAddress: '午门', displayRegion: '北京市', displayRegionEnabled: true, latitude: 39.9, longitude: 116.4, altitude: 50 } });
    await repository.savePhoto({ id: 'target-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Target', description: '', published: true, hidden: false, rating: 2, location: null, metadata: { displayAddress: '原地址', custom: 'keep' } });
    const service = new AdminService(repository);

    const result = await service.copyPhotoFields(actor, 'source-photo', ['target-photo'], ['rating']);

    expect(result.skippedIds).toEqual([]);
    expect(result.photos[0]).toMatchObject({ id: 'target-photo', rating: 7, location: null, metadata: { displayAddress: '原地址', custom: 'keep' } });
  });

  it('copies location and address fields together and preserves target-only metadata', async () => {
    const repository = new MemoryRepository();
    await repository.savePhoto({ id: 'source-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Source', description: '', published: true, hidden: false, rating: null, latitude: 39.9, longitude: 116.4, location: { id: 'source-location', name: '北京故宫' }, metadata: { displayAddress: '午门', displayRegion: '北京市', displayRegionEnabled: true, latitude: 39.9, longitude: 116.4, altitude: 50 } });
    await repository.savePhoto({ id: 'target-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Target', description: '', published: true, hidden: false, rating: 2, location: null, metadata: { custom: 'keep' } });
    const service = new AdminService(repository);

    const result = await service.copyPhotoFields(actor, 'source-photo', ['target-photo'], ['location', 'address']);

    expect(result.photos[0]).toMatchObject({ location: { name: '北京故宫' }, latitude: 39.9, longitude: 116.4, metadata: { displayAddress: '午门', displayRegion: '北京市', displayRegionEnabled: true, altitude: 50, custom: 'keep' } });
  });

  it('copies each publication status and keeps the source unchanged', async () => {
    const scenarios = [
      { name: 'published', source: { published: true, hidden: false, ownerOnly: false }, expected: { published: true, hidden: false, ownerOnly: false } },
      { name: 'owner-only', source: { published: true, hidden: false, ownerOnly: true }, expected: { published: true, hidden: false, ownerOnly: true } },
      { name: 'hidden', source: { published: false, hidden: true, ownerOnly: false }, expected: { published: false, hidden: true, ownerOnly: false } },
    ] as const;

    for (const scenario of scenarios) {
      const repository = new MemoryRepository();
      await repository.savePhoto({ id: 'source-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Source', description: '', rating: null, metadata: scenario.source.ownerOnly ? { ownerOnly: true } : {}, ...scenario.source });
      await repository.savePhoto({ id: 'target-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Target', description: '', rating: null, published: true, hidden: false, ownerOnly: true, metadata: { ownerOnly: true, custom: 'keep' } });
      const service = new AdminService(repository);

      const result = await service.copyPhotoFields(actor, 'source-photo', ['target-photo'], ['status']);

      expect(result.photos[0]).toMatchObject({ id: 'target-photo', ...scenario.expected, metadata: { custom: 'keep', ...(scenario.expected.ownerOnly ? { ownerOnly: true } : {}) } });
      if (!scenario.expected.ownerOnly) expect(result.photos[0].metadata).not.toHaveProperty('ownerOnly');
      await expect(repository.findPhoto(PRIMARY_WORKSPACE_ID, 'source-photo')).resolves.toMatchObject(scenario.source);
    }
  });

  it('deletes a photo, removes album references, and cleans its storage variants', async () => {
    const repository = new MemoryRepository();
    await repository.savePhoto({ id: 'delete-photo', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Delete me', description: '', published: true, hidden: false, rating: null, metadata: { storageKeys: ['photos/delete/original.jpg', 'photos/delete/thumbnail.jpg'] } });
    await repository.saveAlbum({ id: 'album-delete', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Album', coverPhotoId: 'delete-photo', sortOrder: 0, photoIds: ['delete-photo'] });
    const deletedKeys: string[] = [];
    const storage = { deleteObject: async (key: string) => { deletedKeys.push(key); } } as unknown as StorageAdapter;
    const service = new AdminService(repository, undefined, storage);

    await service.deletePhoto(actor, 'delete-photo');

    await expect(repository.findPhoto(PRIMARY_WORKSPACE_ID, 'delete-photo')).resolves.toBeUndefined();
    await expect(repository.findAlbum(PRIMARY_WORKSPACE_ID, 'album-delete')).resolves.toMatchObject({ coverPhotoId: null, photoIds: [] });
    expect(deletedKeys).toEqual(['photos/delete/original.jpg', 'photos/delete/thumbnail.jpg']);
  });
});
