import { describe, expect, it } from 'vitest';
import { duplicateByChecksum, matchManifest, normalizeRelativePath } from './dedupe.js';

describe('import deduplication', () => {
  it('matches normalized paths before falling back to filenames', () => {
    expect(normalizeRelativePath('./Photos\\Sunset.JPG')).toBe('photos/sunset.jpg');
    const exact = matchManifest('Photos/Sunset.JPG', [{ sourceKey: 'photos/sunset.jpg', fields: { rating: 5 } }]);
    expect(exact.record?.fields?.rating).toBe(5);
    const ambiguous = matchManifest('a/sunset.jpg', [{ sourceKey: 'one/sunset.jpg' }, { sourceKey: 'two/sunset.jpg' }]);
    expect(ambiguous.ambiguous).toBe(true);
  });

  it('reports repeated checksums', () => { expect(duplicateByChecksum(['a', 'b', 'a', 'a'])).toEqual(new Set(['a'])); });
});
