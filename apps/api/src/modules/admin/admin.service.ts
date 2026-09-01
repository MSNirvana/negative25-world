import { ApiError, type ElevationCoordinate } from '@negative25/utils';
import { isPhotoPublic, type AppRepository, type PhotoLocationRecord, type PhotoRecord, type WorkspaceMemberRecord } from '../../db/repository.js';

export type AdminPhoto = Pick<PhotoRecord, 'id' | 'workspaceId' | 'title' | 'description' | 'published' | 'hidden' | 'ownerOnly' | 'rating' | 'location' | 'latitude' | 'longitude' | 'metadata' | 'thumbnail'>;
export type AdminPhotoLocationPatch = { name: string; latitude: number; longitude: number; displayAddress?: string; displayRegion?: string; displayRegionEnabled?: boolean } | null;
export type AdminPhotoPatch = Partial<Pick<AdminPhoto, 'title' | 'description' | 'published' | 'hidden' | 'ownerOnly' | 'rating'>> & { location?: AdminPhotoLocationPatch };
export type AdminActor = { userId: string; workspaceId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type ElevationLookup = (coordinate: ElevationCoordinate) => Promise<number | undefined>;

export class AdminService {
  constructor(private readonly repository: AppRepository, private readonly lookupElevation: ElevationLookup = () => Promise.resolve(undefined)) {}
  async listPhotos(actor: AdminActor): Promise<AdminPhoto[]> { this.requireRole(actor, ['owner', 'admin', 'editor', 'viewer']); return (await this.repository.listPhotos(actor.workspaceId)) as AdminPhoto[]; }
  async summary(actor: AdminActor) { this.requireRole(actor, ['owner', 'admin', 'editor', 'viewer']); return this.repository.getWorkspaceSummary(actor.workspaceId); }
  async patchPhoto(actor: AdminActor, id: string, patch: AdminPhotoPatch): Promise<AdminPhoto> {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const photo = await this.repository.findPhoto(actor.workspaceId, id);
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
    const updated = await this.repository.updatePhoto(id, actor.workspaceId, photoPatch);
    if (!updated) throw new ApiError('NOT_FOUND', 'Photo not found');
    return updated as AdminPhoto;
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
  private requireRole(actor: AdminActor, roles: AdminActor['role'][]): void { if (!roles.includes(actor.role)) throw new ApiError('FORBIDDEN', 'Insufficient workspace role'); }
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}
