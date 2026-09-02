import { ApiError, type ElevationCoordinate } from '@negative25/utils';
import { isPhotoPublic, type AppRepository, type PhotoImportBatch, type PhotoLocationRecord, type PhotoRecord, type WorkspaceMemberRecord } from '../../db/repository.js';
import type { StorageAdapter } from '../media/storage.js';

export type AdminPhoto = Pick<PhotoRecord, 'id' | 'workspaceId' | 'title' | 'description' | 'published' | 'hidden' | 'ownerOnly' | 'rating' | 'location' | 'latitude' | 'longitude' | 'metadata' | 'thumbnail' | 'media'> & { importBatch?: PhotoImportBatch };
export type AdminPhotoLocationPatch = { name: string; latitude: number; longitude: number; displayAddress?: string; displayRegion?: string; displayRegionEnabled?: boolean } | null;
export type AdminPhotoPatch = Partial<Pick<AdminPhoto, 'title' | 'description' | 'published' | 'hidden' | 'ownerOnly' | 'rating'>> & { location?: AdminPhotoLocationPatch };
export type AdminPhotoCopyField = 'location' | 'address' | 'rating' | 'status';
export type AdminActor = { userId: string; workspaceId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type ElevationLookup = (coordinate: ElevationCoordinate) => Promise<number | undefined>;

export class AdminService {
  constructor(private readonly repository: AppRepository, private readonly lookupElevation: ElevationLookup = () => Promise.resolve(undefined), private readonly storage?: StorageAdapter) {}
  async listPhotos(actor: AdminActor): Promise<AdminPhoto[]> { this.requireRole(actor, ['owner', 'admin', 'editor', 'viewer']); return (await this.repository.listPhotos(actor.workspaceId, { includeImportBatch: true })) as AdminPhoto[]; }
  async summary(actor: AdminActor) { this.requireRole(actor, ['owner', 'admin', 'editor', 'viewer']); return this.repository.getWorkspaceSummary(actor.workspaceId); }
  async patchPhoto(actor: AdminActor, id: string, patch: AdminPhotoPatch): Promise<AdminPhoto> {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const photo = await this.repository.findPhoto(actor.workspaceId, id, { includeImportBatch: true });
    if (!photo) throw new ApiError('NOT_FOUND', 'Photo not found');
    const { location, ownerOnly, ...photoPatch } = patch;
    let metadataPatch: Record<string, unknown> | undefined;
    if (ownerOnly !== undefined) {
      metadataPatch = { ...(photo.metadata ?? {}) };
      if (ownerOnly) metadataPatch.ownerOnly = true;
      else delete metadataPatch.ownerOnly;
      Object.assign(photoPatch, {
        metadata: metadataPatch,
        ownerOnly,
        ...(ownerOnly ? { published: true, hidden: false } : {}),
      });
    }
    if (location !== undefined) {
      const metadata = { ...(metadataPatch ?? photo.metadata ?? {}) };
      if (location === null) {
        delete metadata.locationName;
        delete metadata.locationSource;
        delete metadata.latitude;
        delete metadata.longitude;
        delete metadata.altitude;
        delete metadata.displayAddress;
        delete metadata.displayRegion;
        delete metadata.displayRegionEnabled;
      } else {
        const previousLatitude = numberValue(photo.latitude ?? metadata.latitude);
        const previousLongitude = numberValue(photo.longitude ?? metadata.longitude);
        const previousAltitude = numberValue(metadata.altitude);
        const coordinatesChanged = previousLatitude !== location.latitude || previousLongitude !== location.longitude;
        if (location.name.trim()) metadata.locationName = location.name.trim();
        else delete metadata.locationName;
        const displayAddress = location.displayAddress?.trim() ?? '';
        const displayRegion = location.displayRegion?.trim() ?? '';
        if (displayAddress) metadata.displayAddress = displayAddress;
        else delete metadata.displayAddress;
        if (displayRegion) metadata.displayRegion = displayRegion;
        else delete metadata.displayRegion;
        if (location.displayRegionEnabled !== undefined) metadata.displayRegionEnabled = location.displayRegionEnabled;
        metadata.locationSource = 'manual';
        metadata.latitude = location.latitude;
        metadata.longitude = location.longitude;
        if (coordinatesChanged) delete metadata.altitude;
        if (coordinatesChanged || previousAltitude === undefined) {
          const altitude = await this.lookupElevation({ latitude: location.latitude, longitude: location.longitude });
          if (altitude !== undefined) metadata.altitude = altitude;
        }
      }
      Object.assign(photoPatch, {
        metadata,
        latitude: location?.latitude,
        longitude: location?.longitude,
        location: location && location.name.trim() ? { id: `photo-${photo.id}-location`, name: location.name.trim() } satisfies PhotoLocationRecord : null,
      });
    }
    const updated = await this.repository.updatePhoto(id, actor.workspaceId, photoPatch, { includeImportBatch: true });
    if (!updated) throw new ApiError('NOT_FOUND', 'Photo not found');
    return updated as AdminPhoto;
  }
  async copyPhotoFields(actor: AdminActor, sourceId: string, targetIds: string[], fields: AdminPhotoCopyField[]): Promise<{ photos: AdminPhoto[]; skippedIds: string[] }> {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const uniqueFields = [...new Set(fields)];
    if (!uniqueFields.length) throw new ApiError('VALIDATION_ERROR', 'At least one photo field is required');
    const source = await this.repository.findPhoto(actor.workspaceId, sourceId, { includeImportBatch: true });
    if (!source) throw new ApiError('NOT_FOUND', 'Source photo not found');
    const uniqueTargets = [...new Set(targetIds)].filter((id) => id !== sourceId);
    const skippedIds: string[] = [];
    const updated: AdminPhoto[] = [];
    for (const id of uniqueTargets) {
      const target = await this.repository.findPhoto(actor.workspaceId, id, { includeImportBatch: true });
      if (!target) { skippedIds.push(id); continue; }
      const patch: Partial<PhotoRecord> = {};
      const sourceMetadata = source.metadata ?? {};
      const metadata = { ...(target.metadata ?? {}) };
      if (uniqueFields.includes('rating')) patch.rating = source.rating;
      if (uniqueFields.includes('status')) {
        const sourceOwnerOnly = source.ownerOnly === true || sourceMetadata.ownerOnly === true;
        if (sourceOwnerOnly) {
          patch.published = true;
          patch.hidden = false;
          patch.ownerOnly = true;
          metadata.ownerOnly = true;
        } else if (source.published && !source.hidden) {
          patch.published = true;
          patch.hidden = false;
          patch.ownerOnly = false;
          delete metadata.ownerOnly;
        } else {
          patch.published = false;
          patch.hidden = true;
          patch.ownerOnly = false;
          delete metadata.ownerOnly;
        }
      }
      if (uniqueFields.includes('location')) {
        const latitude = numberValue(source.latitude ?? sourceMetadata.latitude);
        const longitude = numberValue(source.longitude ?? sourceMetadata.longitude);
        if (latitude === undefined || longitude === undefined) {
          delete metadata.locationName;
          delete metadata.locationSource;
          delete metadata.latitude;
          delete metadata.longitude;
          delete metadata.altitude;
          patch.latitude = undefined;
          patch.longitude = undefined;
          patch.location = null;
        } else {
          metadata.latitude = latitude;
          metadata.longitude = longitude;
          metadata.locationSource = sourceMetadata.locationSource ?? 'manual';
          const locationName = source.location?.name?.trim() || textValue(sourceMetadata.locationName);
          if (locationName) {
            metadata.locationName = locationName;
            patch.location = { id: `photo-${target.id}-location`, name: locationName };
          } else {
            delete metadata.locationName;
            patch.location = null;
          }
          const altitude = numberValue(sourceMetadata.altitude);
          if (altitude === undefined) delete metadata.altitude;
          else metadata.altitude = altitude;
          patch.latitude = latitude;
          patch.longitude = longitude;
        }
      }
      if (uniqueFields.includes('address')) {
        const displayAddress = textValue(sourceMetadata.displayAddress);
        const displayRegion = textValue(sourceMetadata.displayRegion);
        if (displayAddress) metadata.displayAddress = displayAddress;
        else delete metadata.displayAddress;
        if (displayRegion) metadata.displayRegion = displayRegion;
        else delete metadata.displayRegion;
        if (typeof sourceMetadata.displayRegionEnabled === 'boolean') metadata.displayRegionEnabled = sourceMetadata.displayRegionEnabled;
        else delete metadata.displayRegionEnabled;
      }
      if (uniqueFields.includes('location') || uniqueFields.includes('address') || uniqueFields.includes('status')) patch.metadata = metadata;
      const result = await this.repository.updatePhoto(id, actor.workspaceId, patch, { includeImportBatch: true });
      if (result) updated.push(result as AdminPhoto);
      else skippedIds.push(id);
    }
    return { photos: updated, skippedIds };
  }
  async deletePhoto(actor: AdminActor, id: string): Promise<void> {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const photo = await this.repository.findPhoto(actor.workspaceId, id);
    if (!photo) throw new ApiError('NOT_FOUND', 'Photo not found');
    await this.removeStorage(await this.repository.listPhotoStorageKeys(actor.workspaceId, id));
    const deleted = await this.repository.deletePhoto(id, actor.workspaceId);
    if (!deleted) throw new ApiError('NOT_FOUND', 'Photo not found');
  }
  async deletePhotos(actor: AdminActor, ids: string[]): Promise<{ deletedIds: string[]; skippedIds: string[] }> {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const uniqueIds = [...new Set(ids)];
    const existing = new Map<string, string[]>();
    const skippedIds: string[] = [];
    for (const id of uniqueIds) {
      if (!await this.repository.findPhoto(actor.workspaceId, id)) { skippedIds.push(id); continue; }
      existing.set(id, await this.repository.listPhotoStorageKeys(actor.workspaceId, id));
    }
    await this.removeStorage([...existing.values()].flat());
    const deletedIds: string[] = [];
    for (const id of existing.keys()) if (await this.repository.deletePhoto(id, actor.workspaceId)) deletedIds.push(id); else skippedIds.push(id);
    return { deletedIds, skippedIds };
  }
  async isPublic(workspaceId: string, id: string): Promise<boolean> { const photo = await this.repository.findPhoto(workspaceId, id); return Boolean(photo && isPhotoPublic(photo)); }
  async members(actor: AdminActor): Promise<WorkspaceMemberRecord[]> { this.requireRole(actor, ['owner', 'admin']); return this.repository.listWorkspaceMembers(actor.workspaceId); }
  async patchMember(actor: AdminActor, userId: string, role: AdminActor['role']): Promise<WorkspaceMemberRecord> {
    this.requireRole(actor, ['owner', 'admin']);
    const members = await this.repository.listWorkspaceMembers(actor.workspaceId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) throw new ApiError('NOT_FOUND', 'Member not found');
    if (actor.userId === userId && role !== member.role) throw new ApiError('CONFLICT', 'You cannot change your own role');
    if (actor.role !== 'owner' && (member.role === 'owner' || role === 'owner')) throw new ApiError('FORBIDDEN', 'Only an owner can manage owners');
    await this.repository.updateMembershipRole(actor.workspaceId, userId, role);
    return { ...member, role };
  }
  private async removeStorage(keys: string[]): Promise<void> {
    if (!this.storage || !keys.length) return;
    try {
      await Promise.all([...new Set(keys)].map((key) => this.storage!.deleteObject(key)));
    } catch (cause) {
      throw new ApiError('STORAGE_ERROR', cause instanceof Error ? `Photo storage cleanup failed: ${cause.message}` : 'Photo storage cleanup failed');
    }
  }
  private requireRole(actor: AdminActor, roles: AdminActor['role'][]): void { if (!roles.includes(actor.role)) throw new ApiError('FORBIDDEN', 'Insufficient workspace role'); }
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}
