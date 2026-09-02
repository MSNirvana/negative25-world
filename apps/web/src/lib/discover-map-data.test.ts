import { describe, expect, it } from 'vitest';
import type { GalleryPhoto } from '../stores/gallery';
import { clusterLocations, filterLocations, fromAMapCoordinates, groupForAddressParts, groupPhotosByRegion, isValidCoordinates, normalizeLocations, photosInCircle, pointInCircle, projectCoordinates, toAMapCoordinates } from './discover-map-data';

function photo(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
  return {
    id: 'photo-1', title: 'Harbour light', caption: 'A quiet morning', capturedAt: '12 Aug 2026', location: 'Cornwall, UK', aspectRatio: 1.5, image: 'https://example.com/thumb.jpg', fullImage: 'https://example.com/full.jpg', tone: '#cbd3d4', camera: 'Nikon', lens: '35mm', focalLength: '35mm', aperture: 'f/2', shutterSpeed: '1/250s', iso: 'ISO 100', rating: null, ...overrides,
  };
}

describe('discover map data', () => {
  it('projects valid coordinates to the world extent', () => {
    expect(projectCoordinates({ latitude: 90, longitude: -180 })).toEqual({ x: 0, y: 0 });
    expect(projectCoordinates({ latitude: 0, longitude: 0 })).toEqual({ x: 600, y: 310 });
    expect(projectCoordinates({ latitude: -90, longitude: 180 })).toEqual({ x: 1200, y: 620 });
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
  });

  it('converts mainland China WGS84 coordinates to AMap GCJ-02', () => {
    const [longitude, latitude] = toAMapCoordinates({ latitude: 39.9042, longitude: 116.4074 });
    expect(longitude).toBeGreaterThan(116.4074);
    expect(latitude).toBeGreaterThan(39.9042);
    expect(toAMapCoordinates({ latitude: 51.5074, longitude: -0.1278 })).toEqual([-0.1278, 51.5074]);
  });

  it('round trips AMap China coordinates back to WGS84 for custom pins', () => {
    const source = { latitude: 39.9042, longitude: 116.4074 };
    const restored = fromAMapCoordinates(toAMapCoordinates(source));
    expect(restored.latitude).toBeCloseTo(source.latitude, 5);
    expect(restored.longitude).toBeCloseTo(source.longitude, 5);
  });

  it('keeps unlocated photos out of map locations', () => {
    const mapped = photo({ coordinates: { latitude: 50.26, longitude: -5.05 } });
    const unlocated = photo({ id: 'photo-2', location: 'Unspecified location' });
    const locations = normalizeLocations([], [mapped, unlocated]);
    expect(locations).toHaveLength(1);
    expect(locations[0]?.name).toBe('Cornwall, UK');
    expect(locations[0]?.photos.map((item) => item.id)).toEqual(['photo-1']);
  });

  it('creates a coordinate-only place when GPS has no named location', () => {
    const locations = normalizeLocations([], [photo({ location: 'Unspecified location', coordinates: { latitude: 35.01, longitude: 135.76 } })]);
    expect(locations[0]?.name).toBe('35.01, 135.76');
    expect(locations[0]?.photos).toHaveLength(1);
  });

  it('merges API location records with photo-derived records', () => {
    const mapped = photo({ coordinates: { latitude: 50.26, longitude: -5.05 }, locationId: 'cornwall' });
    const locations = normalizeLocations([{ id: 'cornwall', name: 'Cornwall, UK', latitude: 50.26, longitude: -5.05, photoIds: ['photo-1'] }], [mapped]);
    expect(locations).toHaveLength(1);
    expect(locations[0]?.photoIds).toEqual(['photo-1']);
    expect(locations[0]?.group).toBe('britain');
  });

  it('filters by location metadata and clusters nearby points', () => {
    const locations = normalizeLocations([
      { id: 'a', name: 'Auckland', latitude: -36.85, longitude: 174.76 },
      { id: 'b', name: 'Wellington', latitude: -41.28, longitude: 174.77 },
      { id: 'c', name: 'Kyoto', latitude: 35.01, longitude: 135.76 },
    ], [photo({ id: 'photo-2', title: 'Kyoto evening', location: 'Kyoto' })]);
    expect(filterLocations(locations, 'kyoto').map((location) => location.name)).toEqual(['Kyoto']);
    const clusters = clusterLocations(locations, 1);
    expect(clusters.length).toBeLessThanOrEqual(locations.length);
    expect(clusterLocations(locations, 2.8).every((item) => 'location' in item)).toBe(true);
  });

  it('searches locations through province, raw location fields, and photo descriptions', () => {
    const target = photo({ id: 'lijiang', location: '丽江', locationName: '丽江古城', locationRegion: '云南省', caption: '雨后的石板路' });
    const locations = normalizeLocations([{ id: 'lijiang', name: '丽江', latitude: 26.87, longitude: 100.23, photoIds: ['lijiang'] }], [target]);
    expect(filterLocations(locations, '云南省').map((location) => location.id)).toEqual(['lijiang']);
    expect(filterLocations(locations, '古城').map((location) => location.id)).toEqual(['lijiang']);
    expect(filterLocations(locations, '石板路').map((location) => location.id)).toEqual(['lijiang']);
  });

  it('selects unique photos inside a fixed screen-space circle', () => {
    const first = photo({ id: 'first', location: '云南省·丽江' });
    const duplicate = photo({ id: 'first', location: '云南省·丽江' });
    const second = photo({ id: 'second', location: '四川省·成都' });
    const locations = normalizeLocations([
      { id: 'lijiang', name: '云南省·丽江', latitude: 26.87, longitude: 100.23, photoIds: ['first'] },
      { id: 'chengdu', name: '四川省·成都', latitude: 30.67, longitude: 104.06, photoIds: ['second'] },
    ], [first, duplicate, second]);
    expect(pointInCircle({ x: 10, y: 10 }, { x: 0, y: 0 }, 14.2)).toBe(true);
    expect(pointInCircle({ x: 15, y: 0 }, { x: 0, y: 0 }, 14.2)).toBe(false);
    expect(photosInCircle(locations, (location) => location.id === 'lijiang' ? { x: 20, y: 20 } : { x: 200, y: 20 }, { x: 0, y: 0 }, 80).map((item) => item.id)).toEqual(['first']);
  });

  it('groups Chinese photos by province and overseas photos by country', () => {
    const groups = groupPhotosByRegion([
      photo({ id: 'yun-nan', location: '丽江，云南省' }),
      photo({ id: 'si-chuan', location: '四川省·成都' }),
      photo({ id: 'italy', location: 'Dolomites, Italy' }),
      photo({ id: 'unknown', location: 'Unspecified location' }),
    ]);
    expect(groups.map((group) => [group.label, group.photos.map((item) => item.id)])).toEqual([
      ['四川省', ['si-chuan']],
      ['云南省', ['yun-nan']],
      ['Italy', ['italy']],
      ['未分类', ['unknown']],
    ]);
  });

  it('uses a reverse-geocoded province override for incomplete place names', () => {
    const target = photo({ id: 'hangzhou', location: '杭州市' });
    const resolved = new Map([[target.id, groupForAddressParts('浙江省', '中国')]]);
    expect(groupPhotosByRegion([target], 'zh', resolved)[0]?.label).toBe('浙江省');
  });
});
