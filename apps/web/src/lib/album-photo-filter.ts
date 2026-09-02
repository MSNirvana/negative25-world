type DisplayAddressPhoto = { metadata?: Record<string, unknown> };

export function filterAlbumPhotosByDisplayAddress<T extends DisplayAddressPhoto>(photos: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...photos];
  return photos.filter((photo) => {
    const value = photo.metadata?.displayAddress;
    return typeof value === 'string' && value.toLocaleLowerCase().includes(needle);
  });
}
