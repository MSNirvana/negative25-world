import { describe, expect, it } from 'vitest';
import { readCsvManifest, readJsonManifest } from './manifest-reader.js';

describe('manifest readers', () => {
  it('parses strict CSV headers and trims source keys', () => {
    expect(readCsvManifest('sourceKey,title\n photos/a.jpg , "A photo"\n')).toEqual([{ sourceKey: 'photos/a.jpg', title: 'A photo' }]);
  });

  it('accepts JSON arrays and rejects non-record roots', () => {
    expect(readJsonManifest('[{"sourceKey":"a.jpg","rating":5}]')[0]?.rating).toBe(5);
    expect(() => readJsonManifest('{"sourceKey":"a.jpg"}')).toThrow(/array/);
  });
});
