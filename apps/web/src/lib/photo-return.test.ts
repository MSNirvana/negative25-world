import { describe, expect, it } from 'vitest';
import { photoReturnQuery, photoReturnTarget } from './photo-return.js';

describe('photo viewer return routes', () => {
  it('keeps a public in-app Discover route', () => {
    expect(photoReturnTarget('/discover')).toBe('/discover');
    expect(photoReturnQuery('/discover?mode=featured')).toEqual({ returnTo: '/discover?mode=featured' });
  });

  it('rejects external, photo, and malformed return routes', () => {
    expect(photoReturnTarget('https://example.com')).toBeUndefined();
    expect(photoReturnTarget('//example.com')).toBeUndefined();
    expect(photoReturnTarget('/photo/example')).toBeUndefined();
    expect(photoReturnTarget(['/', '/discover'])).toBeUndefined();
  });
});
