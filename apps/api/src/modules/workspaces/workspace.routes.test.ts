import { describe, expect, it } from 'vitest';
import { filterPhotosByLocation, sortPhotos } from './workspace.routes';

describe('gallery location filtering', () => {
  const photos = [
    { id: 'bj', location: { id: 'location-bj', name: '北京市朝阳区' }, metadata: {} },
    { id: 'sz', location: { id: 'location-sz', name: 'Shenzhen, Guangdong, China' }, metadata: {} },
    { id: 'dolomites', location: { id: 'location-dolomites', name: 'Dolomites, Italy' }, metadata: {} },
  ];

  it('matches China region IDs and aliases', () => {
    expect(filterPhotosByLocation(photos, 'beijing').map((photo) => photo.id)).toEqual(['bj']);
    expect(filterPhotosByLocation(photos, 'guangdong').map((photo) => photo.id)).toEqual(['sz']);
  });

  it('groups Shanxi landmarks under the province', () => {
    const shanxiPhotos = [
      { id: 'yungang', location: { id: 'photo-yungang-location', name: '云冈石窟' }, metadata: {} },
      { id: 'wutai', location: { id: 'photo-wutai-location', name: '五台山风景名胜区' }, metadata: {} },
      { id: 'hengshan', location: { id: 'photo-hengshan-location', name: '北岳恒山' }, metadata: {} },
      { id: 'yanmen', location: null, metadata: { locationName: '雁门关景区', displayRegion: '山西省', displayAddress: '雁门关' } },
    ];
    expect(filterPhotosByLocation(shanxiPhotos, 'shanxi').map((photo) => photo.id)).toEqual(['yungang', 'wutai', 'hengshan', 'yanmen']);
  });

  it('matches normalized location slugs for other regions', () => {
    expect(filterPhotosByLocation(photos, 'dolomites-italy').map((photo) => photo.id)).toEqual(['dolomites']);
  });
});

describe('gallery ordering', () => {
  const photos = [
    { id: 'old', title: 'Old', rating: 5, aspectRatio: 1.5, capturedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'new', title: 'New', rating: 5, aspectRatio: 1.5, capturedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'featured', title: 'Featured', rating: 7, aspectRatio: 0.8, capturedAt: '2024-01-01T00:00:00.000Z' },
    { id: 'unrated', title: 'Unrated', rating: null, aspectRatio: 2, capturedAt: '2027-01-01T00:00:00.000Z' },
  ];

  it('orders recent photos newest first', () => {
    expect(sortPhotos(photos, 'recent').map((photo) => photo.id)).toEqual(['unrated', 'new', 'old', 'featured']);
  });

  it('uses deterministic featured tie breakers', () => {
    expect(sortPhotos(photos, 'featured').map((photo) => photo.id)).toEqual(['featured', 'new', 'old', 'unrated']);
  });

  it('keeps seeded shuffle order stable across requests', () => {
    const first = sortPhotos(photos, 'shuffle', 42).map((photo) => photo.id);
    expect(sortPhotos(photos, 'shuffle', 42).map((photo) => photo.id)).toEqual(first);
    expect(sortPhotos(photos, 'shuffle', 43).map((photo) => photo.id)).not.toEqual(first);
  });
});
