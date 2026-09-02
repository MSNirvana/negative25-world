export type RatioPhoto = { aspectRatio: number };

export type JustifiedRow<T> = {
  photos: T[];
  height: number;
  isLast: boolean;
  startIndex: number;
};

export function targetHeightForWidth(width: number): number {
  if (width < 620) return 160;
  if (width < 1000) return 195;
  if (width < 1500) return 235;
  return 270;
}

export function maxPhotosPerRowForWidth(width: number): number {
  if (width < 620) return 5;
  if (width < 1000) return 7;
  if (width < 1500) return 8;
  return 10;
}

function safeRatio(photo: RatioPhoto): number {
  return Math.max(photo.aspectRatio || 1, 0.45);
}

export function buildJustifiedRows<T extends RatioPhoto>(photos: readonly T[], width: number, gap = 12): JustifiedRow<T>[] {
  const availableWidth = Math.max(width, 720);
  const targetHeight = targetHeightForWidth(width);
  const maxPhotosPerRow = maxPhotosPerRowForWidth(width);
  const nextRows: Array<{ photos: T[]; startIndex: number }> = [];
  let current: T[] = [];
  let currentStart = 0;
  let nextIndex = 0;
  let ratioSum = 0;

  const flush = (): void => {
    if (current.length) nextRows.push({ photos: current, startIndex: currentStart });
    current = [];
    ratioSum = 0;
  };

  for (const photo of photos) {
    const ratio = safeRatio(photo);
    const projectedCount = current.length + 1;
    const projectedRatio = ratioSum + ratio;
    const projectedHeight = (availableWidth - gap * (projectedCount - 1)) / projectedRatio;
    const currentHeight = current.length ? (availableWidth - gap * (current.length - 1)) / ratioSum : Infinity;
    const shouldBreak = current.length >= 1 && current.length >= maxPhotosPerRow;
    const wouldBeTooShort = current.length >= 1 && projectedHeight < targetHeight * 0.76;
    const currentIsCloser = Math.abs(currentHeight - targetHeight) <= Math.abs(projectedHeight - targetHeight);

    if (shouldBreak || (wouldBeTooShort && currentIsCloser)) flush();
    if (!current.length) currentStart = nextIndex;
    current.push(photo);
    nextIndex += 1;
    ratioSum += ratio;
  }
  flush();

  return nextRows.map(({ photos: items, startIndex }, index) => {
    const ratio = items.reduce((sum, photo) => sum + safeRatio(photo), 0);
    const fullWidthHeight = (availableWidth - gap * (items.length - 1)) / ratio;
    const isLast = index === nextRows.length - 1;
    return { photos: items, height: isLast ? Math.min(targetHeight, fullWidthHeight) : fullWidthHeight, isLast, startIndex };
  });
}

export function justifiedCellStyle<T extends RatioPhoto>(row: JustifiedRow<T>, photo: T): Record<string, string> {
  const ratio = safeRatio(photo);
  if (!row.isLast) return { flex: `${ratio} 1 0` };
  return { flex: `0 1 ${Math.max(row.height * ratio, 1)}px` };
}
