import { describe, expect, it } from 'vitest';
import { photoReturnQuery, photoReturnScroll, photoReturnTarget } from './photo-return.js';

describe('photo viewer return routes', () => {
  it('keeps a public in-app Discover route', () => {
    expect(photoReturnTarget('/discover')).toBe('/discover');
    expect(photoReturnQuery('/discover?mode=featured', 321)).toEqual({ returnTo: '/discover?mode=featured', returnScroll: '321' });
  });

  it('parses only safe non-negative scroll offsets', () => {
    expect(photoReturnScroll('321')).toBe(321);
    expect(photoReturnScroll('-1')).toBeUndefined();
    expect(photoReturnScroll('1.5')).toBeUndefined();
  });

  it('rejects external, photo, and malformed return routes', () => {
    expect(photoReturnTarget('https://example.com')).toBeUndefined();
    expect(photoReturnTarget('//example.com')).toBeUndefined();
    expect(photoReturnTarget('/photo/example')).toBeUndefined();
    expect(photoReturnTarget(['/', '/discover'])).toBeUndefined();
  });
});
