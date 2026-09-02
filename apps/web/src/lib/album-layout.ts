type AlbumPhoto = {
  id: string;
  rating: number | null;
  capturedAt: string;
};

export function sortAlbumPhotos<T extends AlbumPhoto>(photos: readonly T[]): T[] {
  return [...photos].sort((left, right) => {
    const ratingDifference = (right.rating ?? -1) - (left.rating ?? -1);
    if (ratingDifference) return ratingDifference;

    const rightCapturedAt = Date.parse(right.capturedAt);
    const leftCapturedAt = Date.parse(left.capturedAt);
    const rightTime = Number.isFinite(rightCapturedAt) ? rightCapturedAt : Number.NEGATIVE_INFINITY;
    const leftTime = Number.isFinite(leftCapturedAt) ? leftCapturedAt : Number.NEGATIVE_INFINITY;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return left.id.localeCompare(right.id);
  });
}
