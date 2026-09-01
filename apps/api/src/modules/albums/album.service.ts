import { randomUUID } from 'node:crypto';
import { ApiError } from '@negative25/utils';
import { isPhotoPublic, type AlbumRecord, type AppRepository, type PhotoRecord } from '../../db/repository.js';

export type AlbumActor = { userId: string; workspaceId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type AlbumInput = { title: string; description?: string; shootDate?: string | null; coverPhotoId?: string | null; photoIds?: string[]; sortOrder?: number };

export class AlbumService {
  constructor(private readonly repository: AppRepository) {}

  async listPublic(workspaceId: string) {
    const albums = await this.repository.listAlbums(workspaceId, true);
    const photos = await this.repository.listPhotos(workspaceId);
    return albums.map((album) => this.toSummary(album, photos));
  }

  async getPublic(workspaceId: string, albumId: string) {
    const album = await this.repository.findAlbum(workspaceId, albumId, true);
    if (!album) throw new ApiError('NOT_FOUND', 'Album not found');
    const photos = (await this.repository.listPhotos(workspaceId)).filter((photo) => album.photoIds.includes(photo.id) && isPhotoPublic(photo));
    if (!photos.length) throw new ApiError('NOT_FOUND', 'Album not found');
    return { ...this.toSummary(album, photos), photos };
  }

  async listAdmin(actor: AlbumActor) {
    this.requireRole(actor, ['owner', 'admin', 'editor', 'viewer']);
    const albums = await this.repository.listAlbums(actor.workspaceId);
    return albums.map((album) => this.toAdmin(album));
  }

  async create(actor: AlbumActor, input: AlbumInput) {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const photoIds = await this.validatePhotoIds(actor.workspaceId, input.photoIds ?? []);
    const coverPhotoId = await this.validateCover(actor.workspaceId, input.coverPhotoId ?? null);
    const album: AlbumRecord = { id: randomUUID(), workspaceId: actor.workspaceId, title: input.title, description: input.description, shootDate: input.shootDate ?? null, coverPhotoId, sortOrder: input.sortOrder ?? 0, photoIds };
    await this.repository.saveAlbum(album);
    return this.toAdmin(album);
  }

  async update(actor: AlbumActor, id: string, input: Partial<AlbumInput>) {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    const existing = await this.repository.findAlbum(actor.workspaceId, id);
    if (!existing) throw new ApiError('NOT_FOUND', 'Album not found');
    const shootDate = input.shootDate === undefined ? existing.shootDate ?? null : input.shootDate;
    const coverPhotoId = input.coverPhotoId === undefined ? existing.coverPhotoId : await this.validateCover(actor.workspaceId, input.coverPhotoId);
    const patch = { ...(input.title === undefined ? {} : { title: input.title }), ...(input.description === undefined ? {} : { description: input.description }), shootDate, ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }), coverPhotoId };
    const updated = await this.repository.updateAlbum(existing.id, actor.workspaceId, patch);
    if (!updated) throw new ApiError('NOT_FOUND', 'Album not found');
    if (input.photoIds !== undefined) {
      const photoIds = await this.validatePhotoIds(actor.workspaceId, input.photoIds);
      const withPhotos = await this.repository.setAlbumPhotos(updated.id, actor.workspaceId, photoIds);
      return this.toAdmin(withPhotos ?? { ...updated, photoIds });
    }
    return this.toAdmin(updated);
  }

  async remove(actor: AlbumActor, id: string): Promise<void> {
    this.requireRole(actor, ['owner', 'admin', 'editor']);
    if (!(await this.repository.deleteAlbum(id, actor.workspaceId))) throw new ApiError('NOT_FOUND', 'Album not found');
  }

  private toSummary(album: AlbumRecord, photos: PhotoRecord[]) {
    const visible = photos.filter((photo) => album.photoIds.includes(photo.id) && isPhotoPublic(photo));
    const cover = visible.find((photo) => photo.id === album.coverPhotoId) ?? visible[0] ?? null;
    return { id: album.id, spaceSlug: album.spaceSlug ?? 'primary', title: album.title, ...(album.description ? { description: album.description } : {}), shootDate: album.shootDate ?? null, cover, photoCount: visible.length };
  }

  private toAdmin(album: AlbumRecord) { return { id: album.id, workspaceId: album.workspaceId, title: album.title, ...(album.description ? { description: album.description } : {}), shootDate: album.shootDate ?? null, coverPhotoId: album.coverPhotoId, photoIds: [...album.photoIds], photoCount: album.photoIds.length }; }

  private async validatePhotoIds(workspaceId: string, photoIds: string[]): Promise<string[]> {
    const unique = [...new Set(photoIds)];
    const photos = await this.repository.listPhotos(workspaceId);
    const known = new Set(photos.map((photo) => photo.id));
    if (unique.some((id) => !known.has(id))) throw new ApiError('NOT_FOUND', 'Album photo not found');
    return unique;
  }

  private async validateCover(workspaceId: string, photoId: string | null | undefined): Promise<string | null> {
    if (!photoId) return null;
    if (!(await this.repository.findPhoto(workspaceId, photoId))) throw new ApiError('NOT_FOUND', 'Album cover photo not found');
    return photoId;
  }

  private requireRole(actor: AlbumActor, roles: AlbumActor['role'][]): void { if (!roles.includes(actor.role)) throw new ApiError('FORBIDDEN', 'Insufficient workspace role'); }
}
