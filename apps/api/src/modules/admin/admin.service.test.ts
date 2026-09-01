import { describe, expect, it, vi } from 'vitest';
import { MemoryRepository, PRIMARY_WORKSPACE_ID } from '../../db/repository.js';
import { AdminService } from './admin.service.js';

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
