import { describe, expect, it } from 'vitest';
import { filterPhotosByLocation } from './workspace.routes';

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
    ];
    expect(filterPhotosByLocation(shanxiPhotos, 'shanxi').map((photo) => photo.id)).toEqual(['yungang', 'wutai', 'hengshan']);
  });

  it('matches normalized location slugs for other regions', () => {
    expect(filterPhotosByLocation(photos, 'dolomites-italy').map((photo) => photo.id)).toEqual(['dolomites']);
  });
});
