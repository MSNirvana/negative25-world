import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildLocationOptions } from '../lib/location-options';

const { fetchGalleryMock, isApiConfiguredMock } = vi.hoisted(() => ({
  fetchGalleryMock: vi.fn(),
  isApiConfiguredMock: vi.fn(() => false),
}));

vi.mock('../api/client', () => ({
  fetchGallery: fetchGalleryMock,
  fetchPhoto: vi.fn(),
  isApiConfigured: isApiConfiguredMock,
}));

import { useGalleryStore } from './gallery';

function summary(id: string, location: string, displayRegion?: string) {
  return {
    id,
    spaceSlug: 'primary',
    title: id,
    description: '',
    capturedAt: '2026-01-02T03:04:05.000Z',
    rating: null,
    aspectRatio: 1.5,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}.jpg`, width: 300, height: 200, format: 'jpeg' },
    media: [],
    location: { id: `location-${id}`, name: location },
    metadata: displayRegion ? { displayRegion } : {},
  };
}

describe('gallery location catalog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchGalleryMock.mockReset();
    isApiConfiguredMock.mockReturnValue(true);
  });

  it('loads every public page and deduplicates photo IDs for region counts', async () => {
    fetchGalleryMock
      .mockResolvedValueOnce({ photos: [summary('shanxi-1', '雁门关'), summary('shanxi-2', '五台山风景名胜区')], pagination: { nextCursor: '100', hasMore: true } })
      .mockResolvedValueOnce({ photos: [summary('shanxi-2', '五台山风景名胜区'), summary('yunnan-1', '丽江', '云南省')], pagination: { nextCursor: null, hasMore: false } });

    const gallery = useGalleryStore();
    gallery.setContext('primary', 'token');
    await gallery.loadLocationCatalog();

    expect(fetchGalleryMock).toHaveBeenCalledTimes(2);
    expect(gallery.locationPhotos.map((photo) => photo.id)).toEqual(['shanxi-1', 'shanxi-2', 'yunnan-1']);
    expect(gallery.locationCatalogReady).toBe(true);
    expect(buildLocationOptions(gallery.locationPhotos).find((option) => option.id === 'shanxi')?.count).toBe(2);
    expect(buildLocationOptions(gallery.locationPhotos).find((option) => option.id === 'yunnan')?.count).toBe(1);
  });

  it('keeps completed pages when a later catalog request fails', async () => {
    fetchGalleryMock
      .mockResolvedValueOnce({ photos: [summary('shanxi-1', '雁门关')], pagination: { nextCursor: '100', hasMore: true } })
      .mockRejectedValueOnce(new Error('catalog unavailable'));

    const gallery = useGalleryStore();
    gallery.setContext('primary', 'token');
    await gallery.loadLocationCatalog();

    expect(gallery.locationPhotos.map((photo) => photo.id)).toEqual(['shanxi-1']);
    expect(gallery.locationCatalogReady).toBe(false);
    expect(gallery.locationCatalogLoading).toBe(false);
  });

  it('force refreshes a completed catalog for newly published photos', async () => {
    fetchGalleryMock
      .mockResolvedValueOnce({ photos: [summary('old-photo', '雁门关')], pagination: { nextCursor: null, hasMore: false } })
      .mockResolvedValueOnce({ photos: [summary('new-photo', '南京')], pagination: { nextCursor: null, hasMore: false } });

    const gallery = useGalleryStore();
    gallery.setContext('primary', 'token');
    await gallery.loadLocationCatalog();
    expect(gallery.locationPhotos.map((photo) => photo.id)).toEqual(['old-photo']);

    await gallery.loadLocationCatalog(true);

    expect(fetchGalleryMock).toHaveBeenCalledTimes(2);
    expect(gallery.locationPhotos.map((photo) => photo.id)).toEqual(['new-photo']);
    expect(gallery.locationCatalogReady).toBe(true);
  });
});
