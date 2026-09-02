import type { AdminPhoto } from '../api/client';

export type AdminPhotoGroup = {
  key: string;
  importBatch?: NonNullable<AdminPhoto['importBatch']>;
  photos: AdminPhoto[];
};

export function groupAdminPhotos(photos: readonly AdminPhoto[]): AdminPhotoGroup[] {
  const groups = new Map<string, AdminPhotoGroup>();
  for (const photo of photos) {
    const key = photo.importBatch?.id ?? 'unclassified';
    const group = groups.get(key) ?? { key, importBatch: photo.importBatch, photos: [] };
    group.photos.push(photo);
    groups.set(key, group);
  }
  return [...groups.values()];
}
