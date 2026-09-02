type IdentifiedPhoto = { id: string };

export function areAllBatchPhotosSelected<T extends IdentifiedPhoto>(photos: readonly T[], selectedIds: readonly string[]): boolean {
  if (!photos.length) return false;
  const selected = new Set(selectedIds);
  return photos.every((photo) => selected.has(photo.id));
}

export function toggleBatchPhotoSelection<T extends IdentifiedPhoto>(photos: readonly T[], selectedIds: readonly string[]): string[] {
  const ids = photos.map((photo) => photo.id);
  if (!ids.length) return [...selectedIds];
  if (areAllBatchPhotosSelected(photos, selectedIds)) {
    const batchIds = new Set(ids);
    return selectedIds.filter((id) => !batchIds.has(id));
  }
  return [...new Set([...selectedIds, ...ids])];
}
