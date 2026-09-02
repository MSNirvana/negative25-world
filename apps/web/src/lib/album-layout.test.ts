import { describe, expect, it } from 'vitest';
import { buildJustifiedRows } from './justified-rows';
import { sortAlbumPhotos } from './album-layout';

type TestPhoto = { id: string; rating: number | null; capturedAt: string; aspectRatio: number };

describe('album layout', () => {
  it('sorts photos by rating, capture time, then ID', () => {
    const photos: TestPhoto[] = [
      { id: 'unrated', rating: null, capturedAt: '2026-01-05T00:00:00.000Z', aspectRatio: 1 },
      { id: 'rating-6-old', rating: 6, capturedAt: '2025-01-01T00:00:00.000Z', aspectRatio: 1 },
      { id: 'rating-7', rating: 7, capturedAt: '2025-01-01T00:00:00.000Z', aspectRatio: 1 },
      { id: 'rating-6-new', rating: 6, capturedAt: '2026-01-01T00:00:00.000Z', aspectRatio: 1 },
      { id: 'rating-0', rating: 0, capturedAt: '2026-01-06T00:00:00.000Z', aspectRatio: 1 },
      { id: 'rating-6-same-time-b', rating: 6, capturedAt: '2025-01-01T00:00:00.000Z', aspectRatio: 1 },
    ];

    expect(sortAlbumPhotos(photos).map((photo) => photo.id)).toEqual([
      'rating-7', 'rating-6-new', 'rating-6-old', 'rating-6-same-time-b', 'rating-0', 'unrated',
    ]);
    expect(photos.map((photo) => photo.id)).toEqual(['unrated', 'rating-6-old', 'rating-7', 'rating-6-new', 'rating-0', 'rating-6-same-time-b']);
  });

  it('creates full-width justified rows for non-final rows', () => {
    const photos = Array.from({ length: 12 }, (_, index) => ({ id: String(index), aspectRatio: 1 }));
    const rows = buildJustifiedRows(photos, 1200, 13);

    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows.filter((item) => !item.isLast)) {
      const ratioSum = row.photos.reduce((sum, photo) => sum + photo.aspectRatio, 0);
      expect(row.height * ratioSum + 13 * (row.photos.length - 1)).toBeCloseTo(1200, 5);
    }
  });
});
