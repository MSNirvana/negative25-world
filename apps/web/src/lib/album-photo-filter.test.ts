import { describe, expect, it } from 'vitest';
import { filterAlbumPhotosByDisplayAddress } from './album-photo-filter';

type TestPhoto = { id: string; metadata?: Record<string, unknown> };
const photo = (id: string, displayAddress?: unknown): TestPhoto => ({ id, metadata: displayAddress === undefined ? {} : { displayAddress } });

describe('filterAlbumPhotosByDisplayAddress', () => {
  const photos = [photo('stork', '山西·鹳雀楼'), photo('palace', '北京·故宫'), photo('missing')];

  it('matches a trimmed display address substring without case sensitivity', () => {
    expect(filterAlbumPhotosByDisplayAddress(photos, '  鹳雀楼  ').map((item) => item.id)).toEqual(['stork']);
    expect(filterAlbumPhotosByDisplayAddress([photo('tower', 'Stork Tower')], ' stork ').map((item) => item.id)).toEqual(['tower']);
  });

  it('returns every photo for an empty query and excludes missing addresses for a non-empty query', () => {
    expect(filterAlbumPhotosByDisplayAddress(photos, '').map((item) => item.id)).toEqual(['stork', 'palace', 'missing']);
    expect(filterAlbumPhotosByDisplayAddress(photos, '景区').map((item) => item.id)).toEqual([]);
  });

  it('ignores non-string metadata values', () => {
    expect(filterAlbumPhotosByDisplayAddress([photo('number', 123), photo('valid', '古城')], '古城').map((item) => item.id)).toEqual(['valid']);
  });
});
