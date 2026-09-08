import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { fetchGalleryMock, fetchPhotoMock, isApiConfiguredMock } = vi.hoisted(() => ({
  fetchGalleryMock: vi.fn(),
  fetchPhotoMock: vi.fn(),
  isApiConfiguredMock: vi.fn(() => true),
}));

vi.mock('../api/client', () => ({
  fetchGallery: fetchGalleryMock,
  fetchPhoto: fetchPhotoMock,
  isApiConfigured: isApiConfiguredMock,
}));

import { useGalleryStore } from './gallery';

function photo(id: string) {
  return {
    id,
    spaceSlug: 'primary',
    title: id,
    description: '',
    capturedAt: '2026-01-02T03:04:05.000Z',
    rating: 7,
    aspectRatio: 1.5,
    thumbnail: { kind: 'thumbnail', url: `https://example.com/${id}.jpg`, width: 300, height: 200, format: 'jpeg' },
    media: [],
    location: null,
    metadata: {},
  };
}

function response(...photos: ReturnType<typeof photo>[]) {
  return { photos, pagination: { nextCursor: null, hasMore: false } };
}

describe('gallery loading', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchGalleryMock.mockReset();
    fetchPhotoMock.mockReset();
    isApiConfiguredMock.mockReturnValue(true);
  });

  it('does not seed demo photos when the API is configured', () => {
    const gallery = useGalleryStore();

    expect(gallery.photos).toEqual([]);
  });

  it('retries a transient empty featured response before clearing the gallery', async () => {
    fetchGalleryMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(photo('featured-photo')));

    const gallery = useGalleryStore();
    await gallery.load('featured');

    expect(fetchGalleryMock).toHaveBeenCalledTimes(2);
    expect(gallery.photos.map((item) => item.id)).toEqual(['featured-photo']);
    expect(gallery.error).toBeNull();
  });

  it('does not let a canceled featured request clear a newer mode', async () => {
    let resolveFeatured!: (value: ReturnType<typeof response>) => void;
    const featuredRequest = new Promise<ReturnType<typeof response>>((resolve) => { resolveFeatured = resolve; });
    fetchGalleryMock
      .mockImplementationOnce(() => featuredRequest)
      .mockResolvedValueOnce(response(photo('recent-photo')));

    const gallery = useGalleryStore();
    const featuredLoad = gallery.load('featured');
    gallery.setMode('recent');
    const recentLoad = gallery.load('recent');
    resolveFeatured(response());
    await Promise.all([featuredLoad, recentLoad]);

    expect(gallery.photos.map((item) => item.id)).toEqual(['recent-photo']);
    expect(gallery.error).toBeNull();
  });

  it('keeps a direct photo detail when a gallery refresh finishes afterward', async () => {
    let resolveGallery!: (value: ReturnType<typeof response>) => void;
    const galleryRequest = new Promise<ReturnType<typeof response>>((resolve) => { resolveGallery = resolve; });
    fetchGalleryMock.mockReturnValue(galleryRequest);
    fetchPhotoMock.mockResolvedValue(response(photo('album-only-photo')).photos[0]);

    const gallery = useGalleryStore();
    const galleryLoad = gallery.load('featured');
    await gallery.loadPhoto('album-only-photo');
    resolveGallery(response(photo('featured-photo')));
    await galleryLoad;

    expect(gallery.photos.map((item) => item.id)).toEqual(['featured-photo']);
    expect(gallery.findPhoto('album-only-photo')?.id).toBe('album-only-photo');
  });
});
