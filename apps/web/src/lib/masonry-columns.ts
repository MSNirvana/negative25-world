export type MasonryPhoto = { id: string; aspectRatio: number };

export type MasonryColumn<T> = {
  index: number;
  photos: T[];
  height: number;
};

export function masonryColumnCountForWidth(width: number): number {
  if (!Number.isFinite(width) || width < 320) return 1;
  if (width < 1000) return 2;
  if (width < 1500) return 3;
  if (width < 1800) return 4;
  return 5;
}

export function masonryGapForWidth(width: number): number {
  return width < 620 ? 8 : width < 1000 ? 10 : 12;
}

function safeRatio(photo: Pick<MasonryPhoto, 'aspectRatio'>): number {
  return Number.isFinite(photo.aspectRatio) && photo.aspectRatio > 0 ? Math.max(photo.aspectRatio, 0.45) : 1;
}

function columnWidth(width: number, columnCount: number, gap: number): number {
  const availableWidth = Math.max(Number.isFinite(width) ? width : 0, 1);
  return Math.max((availableWidth - gap * Math.max(columnCount - 1, 0)) / columnCount, 1);
}

function photoHeight(photo: Pick<MasonryPhoto, 'aspectRatio'>, width: number, columnCount: number, gap: number): number {
  return columnWidth(width, columnCount, gap) / safeRatio(photo);
}

function shortestColumn<T>(columns: readonly MasonryColumn<T>[]): number {
  let shortest = 0;
  for (let index = 1; index < columns.length; index += 1) {
    if ((columns[index]?.height ?? 0) < (columns[shortest]?.height ?? 0)) shortest = index;
  }
  return shortest;
}

function addPhoto<T extends Pick<MasonryPhoto, 'aspectRatio'>>(columns: MasonryColumn<T>[], photo: T, width: number, gap: number): void {
  const columnIndex = shortestColumn(columns);
  const column = columns[columnIndex];
  if (!column) return;
  column.photos.push(photo);
  column.height += (column.photos.length > 1 ? gap : 0) + photoHeight(photo, width, columns.length, gap);
}

export function buildMasonryColumns<T extends MasonryPhoto>(photos: readonly T[], width: number, gap = masonryGapForWidth(width)): MasonryColumn<T>[] {
  const count = Math.min(masonryColumnCountForWidth(width), photos.length);
  const columns = Array.from({ length: count }, (_, index) => ({ index, photos: [], height: 0 })) as MasonryColumn<T>[];
  for (const photo of photos) addPhoto(columns, photo, width, gap);
  return columns;
}

export function appendMasonryColumns<T extends MasonryPhoto>(
  existing: readonly MasonryColumn<T>[],
  previousPhotos: readonly T[],
  photos: readonly T[],
  width: number,
  gap = masonryGapForWidth(width),
): MasonryColumn<T>[] {
  const canAppend = previousPhotos.length > 0
    && photos.length > previousPhotos.length
    && previousPhotos.every((photo, index) => photos[index]?.id === photo.id)
    && existing.length > 0;
  if (!canAppend) return buildMasonryColumns(photos, width, gap);

  const columns = existing.map((column) => ({ ...column, photos: [...column.photos] }));
  for (const photo of photos.slice(previousPhotos.length)) addPhoto(columns, photo, width, gap);
  return columns;
}
