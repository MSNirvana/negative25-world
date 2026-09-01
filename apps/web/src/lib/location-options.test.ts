import { describe, expect, it } from 'vitest';
import { buildLocationOptions, filterPhotosByLocation } from './location-options';

describe('location options', () => {
  const photos = [
    { location: '北京市朝阳区', locationId: 'beijing-photo' },
    { location: '广东省深圳市', locationId: 'guangdong-photo' },
    { location: 'Dolomites, Italy', locationId: undefined },
    { location: 'Dolomites, Italy', locationId: undefined },
  ];

  it('lists all 34 China regions and marks availability from photos', () => {
    const options = buildLocationOptions(photos);
    const china = options.filter((option) => option.group === 'china');
    expect(china).toHaveLength(34);
    expect(china.find((option) => option.id === 'beijing')).toMatchObject({ available: true, count: 1 });
    expect(china.find((option) => option.id === 'guangdong')).toMatchObject({ available: true, count: 1 });
    expect(china.find((option) => option.id === 'sichuan')).toMatchObject({ available: false, count: 0 });
  });

  it('only includes existing non-China regions and filters by stable IDs', () => {
    const options = buildLocationOptions(photos);
    expect(options.filter((option) => option.group === 'other')).toEqual([expect.objectContaining({ label: 'Dolomites, Italy', count: 2 })]);
    expect(filterPhotosByLocation(photos, 'beijing')).toHaveLength(1);
    expect(filterPhotosByLocation(photos, 'dolomites-italy')).toHaveLength(2);
    expect(filterPhotosByLocation(photos, null)).toHaveLength(4);
  });

  it('groups Shanxi landmarks under Shanxi instead of listing each landmark', () => {
    const landmarkPhotos = [
      { location: '云冈石窟', locationId: 'photo-yungang-location' },
      { location: '五台山风景名胜区', locationId: 'photo-wutai-location' },
      { location: '北岳恒山', locationId: 'photo-hengshan-location' },
    ];
    const options = buildLocationOptions(landmarkPhotos);
    expect(options.find((option) => option.id === 'shanxi')).toMatchObject({ available: true, count: 3 });
    expect(options.filter((option) => option.group === 'other')).toHaveLength(0);
    expect(filterPhotosByLocation(landmarkPhotos, 'shanxi')).toHaveLength(3);
  });
});
