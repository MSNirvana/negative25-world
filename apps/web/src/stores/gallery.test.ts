import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { sortGalleryPhotosForMode, toGalleryPhoto, useGalleryStore } from './gallery.js';
import { setLocale } from '../i18n';

vi.mock('../api/client', () => ({
  fetchGallery: vi.fn(),
  fetchPhoto: vi.fn(),
  isApiConfigured: () => false,
}));

describe('gallery store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('clamps photo navigation at both ends', () => {
    const gallery = useGalleryStore();
    gallery.openPhoto(gallery.visiblePhotos[0]!);
    expect(gallery.previousPhoto()).toBeNull();
    expect(gallery.nextPhoto()?.id).toBe(gallery.visiblePhotos[1]?.id);
    gallery.openPhoto(gallery.visiblePhotos.at(-1)!);
    expect(gallery.nextPhoto()).toBeNull();
  });

  it('does not duplicate photo IDs in the demo collection', () => {
    const gallery = useGalleryStore();
    expect(new Set(gallery.photos.map((photo) => photo.id)).size).toBe(gallery.photos.length);
  });

  it('sorts featured work by rating and groups equally rated frame shapes', () => {
    const gallery = useGalleryStore();
    const base = gallery.photos[0]!;
    gallery.photos.splice(0, gallery.photos.length,
      { ...base, id: 'portrait', title: 'Portrait', rating: 7, aspectRatio: 0.8 },
      { ...base, id: 'wide', title: 'Wide', rating: 7, aspectRatio: 1.9 },
      { ...base, id: 'standard', title: 'Standard', rating: 7, aspectRatio: 1.4 },
      { ...base, id: 'lower-rating', title: 'Lower rating', rating: 6, aspectRatio: 2 },
    );
    expect(sortGalleryPhotosForMode(gallery.photos, 'featured').map((photo) => photo.id)).toEqual(['wide', 'standard', 'portrait', 'lower-rating']);
  });

  it('reshuffles when random browse is selected again', () => {
    const gallery = useGalleryStore();
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.01).mockReturnValueOnce(0.99);
    gallery.setMode('shuffle');
    const firstSeed = gallery.shuffleSeed;
    gallery.setMode('shuffle');
    const secondSeed = gallery.shuffleSeed;
    random.mockRestore();
    expect(secondSeed).not.toBe(firstSeed);
    expect(sortGalleryPhotosForMode(gallery.photos, 'shuffle', firstSeed).map((photo) => photo.id))
      .not.toEqual(sortGalleryPhotosForMode(gallery.photos, 'shuffle', secondSeed).map((photo) => photo.id));
  });

  it('maps camera settings, GPS, altitude, and seven-star rating from the API payload', () => {
    setLocale('en');
    const photo = toGalleryPhoto({
      id: 'metadata-photo', spaceSlug: 'primary', title: 'Metadata', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: null, aspectRatio: 1.5,
      thumbnail: { kind: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 300, height: 200, format: 'jpeg' }, media: [], location: null,
      metadata: { cameraMake: 'Nikon', cameraModel: 'Z8', lens: 'NIKKOR', focalLength: 35, aperture: 2.8, shutterSpeed: 0.008, iso: 400, rating: 7, latitude: 39.9042, longitude: 116.4074, altitude: -4.5 },
    });
    expect(photo.camera).toBe('Nikon Z8');
    expect(photo.focalLength).toBe('35mm');
    expect(photo.aperture).toBe('f/2.8');
    expect(photo.shutterSpeed).toBe('1/125s');
    expect(photo.iso).toBe('ISO 400');
    expect(photo.rating).toBe(7);
    expect(photo.coordinates).toEqual({ latitude: 39.9042, longitude: 116.4074 });
    expect(photo.altitude).toBe(-4.5);
    setLocale('zh');
  });

  it('shows the camera model without a repeated manufacturer prefix', () => {
    setLocale('en');
    const photo = toGalleryPhoto({
      id: 'camera-photo', spaceSlug: 'primary', title: 'Camera', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: null, aspectRatio: 1,
      thumbnail: { kind: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 300, height: 300, format: 'jpeg' }, media: [], location: null,
      metadata: { cameraMake: 'NIKON CORPORATION', cameraModel: 'NIKON Z6_3' },
    });
    expect(photo.camera).toBe('NIKON Z6_3');
    const fullNamePhoto = toGalleryPhoto({
      id: 'camera-full-name', spaceSlug: 'primary', title: 'Camera', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: null, aspectRatio: 1,
      thumbnail: { kind: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 300, height: 300, format: 'jpeg' }, media: [], location: null,
      metadata: { camera: 'NIKON CORPORATION NIKON Z6_3' },
    });
    expect(fullNamePhoto.camera).toBe('NIKON Z6_3');
    setLocale('zh');
  });

  it('uses the configured display address without changing the standard location data', () => {
    const basePhoto = {
      id: 'display-location-photo', spaceSlug: 'primary', title: 'Location', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: null, aspectRatio: 1,
      thumbnail: { kind: 'thumbnail' as const, url: 'https://example.com/thumb.jpg', width: 300, height: 300, format: 'jpeg' as const }, media: [],
      location: { id: 'standard-location', name: '永济市鹳雀楼景区' },
    };

    const prefixed = toGalleryPhoto({ ...basePhoto, metadata: { displayAddress: '鹳雀楼', displayRegion: '山西省', displayRegionEnabled: true } });
    const withoutPrefix = toGalleryPhoto({ ...basePhoto, metadata: { displayAddress: '鹳雀楼', displayRegion: '山西省', displayRegionEnabled: false } });
    const legacy = toGalleryPhoto({ ...basePhoto, metadata: {} });

    expect(prefixed.location).toBe('山西·鹳雀楼');
    expect(prefixed.locationId).toBe('standard-location');
    expect(withoutPrefix.location).toBe('鹳雀楼');
    expect(legacy.location).toBe('永济市鹳雀楼景区');
  });

  it('keeps region metadata available when the display prefix is disabled', () => {
    const photo = toGalleryPhoto({
      id: 'region-metadata-photo', spaceSlug: 'primary', title: 'Region metadata', description: '', capturedAt: '2026-01-02T03:04:05.000Z', rating: null, aspectRatio: 1,
      thumbnail: { kind: 'thumbnail', url: 'https://example.com/thumb.jpg', width: 300, height: 300, format: 'jpeg' }, media: [], location: { id: 'yanmen', name: '雁门关景区' },
      metadata: { locationName: '雁门关景区', displayAddress: '雁门关', displayRegion: '山西省', displayRegionEnabled: false },
    });
    expect(photo.location).toBe('雁门关');
    expect(photo.locationName).toBe('雁门关景区');
    expect(photo.locationRegion).toBe('山西省');
  });
});
