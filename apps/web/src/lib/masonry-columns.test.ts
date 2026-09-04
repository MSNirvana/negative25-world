import { describe, expect, it } from 'vitest';
import { appendMasonryColumns, buildMasonryColumns, masonryColumnCountForWidth } from './masonry-columns';

function photo(id: string, aspectRatio: number) { return { id, aspectRatio }; }

describe('masonry columns', () => {
  it('creates no empty columns for an empty gallery', () => {
    expect(buildMasonryColumns([], 1280)).toEqual([]);
  });

  it('balances different photo proportions across the shortest columns', () => {
    const columns = buildMasonryColumns([photo('wide', 1.5), photo('portrait', 0.5), photo('square', 1), photo('tall', 0.7)], 1000, 12);
    expect(columns.map((column) => column.photos.map((item) => item.id))).toEqual([['wide', 'tall'], ['portrait'], ['square']]);
    expect(columns.every((column) => column.height > 0)).toBe(true);
  });

  it('keeps the same assignment for the same input', () => {
    const photos = [photo('a', 1.5), photo('b', 0.8), photo('c', 2), photo('d', 1), photo('e', 0.6)];
    const first = buildMasonryColumns(photos, 1600, 12);
    const second = buildMasonryColumns(photos, 1600, 12);
    expect(second).toEqual(first);
  });

  it('appends new photos without moving existing photos', () => {
    const previous = [photo('a', 1.5), photo('b', 0.8), photo('c', 2)];
    const existing = buildMasonryColumns(previous, 1000, 12);
    const next = appendMasonryColumns(existing, previous, [...previous, photo('d', 1)], 1000, 12);
    expect(next.map((column) => column.photos.filter((item) => previous.some((candidate) => candidate.id === item.id)).map((item) => item.id))).toEqual(existing.map((column) => column.photos.map((item) => item.id)));
    expect(next.flatMap((column) => column.photos.map((item) => item.id))).toContain('d');
  });

  it('falls back to a safe height for invalid aspect ratios', () => {
    const columns = buildMasonryColumns([photo('invalid', Number.NaN)], 1000, 12);
    expect(columns[0]?.height).toBeGreaterThan(0);
  });

  it('selects responsive column counts', () => {
    expect(masonryColumnCountForWidth(280)).toBe(1);
    expect(masonryColumnCountForWidth(500)).toBe(2);
    expect(masonryColumnCountForWidth(800)).toBe(2);
    expect(masonryColumnCountForWidth(1200)).toBe(3);
    expect(masonryColumnCountForWidth(1600)).toBe(4);
    expect(masonryColumnCountForWidth(1920)).toBe(5);
  });
});
