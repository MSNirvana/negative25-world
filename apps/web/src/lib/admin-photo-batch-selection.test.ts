import { describe, expect, it } from 'vitest';
import { areAllBatchPhotosSelected, toggleBatchPhotoSelection } from './admin-photo-batch-selection';

const batch = (ids: string[]) => ids.map((id) => ({ id }));

describe('admin photo batch selection', () => {
  it('selects only the current batch and preserves existing selections', () => {
    expect(toggleBatchPhotoSelection(batch(['a', 'b']), ['other'])).toEqual(['other', 'a', 'b']);
  });

  it('removes the current batch when every visible photo is already selected', () => {
    expect(toggleBatchPhotoSelection(batch(['a', 'b']), ['other', 'a', 'b'])).toEqual(['other']);
  });

  it('reports a batch as fully selected only when it has photos and every photo is selected', () => {
    expect(areAllBatchPhotosSelected(batch(['a', 'b']), ['a', 'b', 'other'])).toBe(true);
    expect(areAllBatchPhotosSelected(batch(['a', 'b']), ['a'])).toBe(false);
    expect(areAllBatchPhotosSelected([], ['other'])).toBe(false);
  });
});
