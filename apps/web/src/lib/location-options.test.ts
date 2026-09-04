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
    expect(options.filter((option) => option.group === 'other')).toEqual([expect.objectContaining({ id: 'italy', label: '意大利', labelEn: 'Italy', count: 2 })]);
    expect(filterPhotosByLocation(photos, 'beijing')).toHaveLength(1);
    expect(filterPhotosByLocation(photos, 'italy')).toHaveLength(2);
    expect(filterPhotosByLocation(photos, 'dolomites-italy')).toHaveLength(2);
    expect(filterPhotosByLocation(photos, null)).toHaveLength(4);
  });

  it('merges manually prefixed Singapore landmarks into one country option', () => {
    const singaporePhotos = [
      { id: 'marina', location: '新加坡·金沙赌场', locationRegion: '新加坡' },
      { id: 'merlion', location: '新加坡·鱼尾狮', locationRegion: '新加坡' },
      { id: 'changi', location: 'Changi Airport, Singapore' },
    ];
    const options = buildLocationOptions(singaporePhotos);
    expect(options.filter((option) => option.group === 'other')).toEqual([expect.objectContaining({ id: 'singapore', label: '新加坡', labelEn: 'Singapore', count: 3 })]);
    expect(filterPhotosByLocation(singaporePhotos, 'singapore').map((photo) => photo.id)).toEqual(['marina', 'merlion', 'changi']);
  });

  it('keeps an explicit unknown country together while leaving unknown places separate', () => {
    const photosWithUnknownRegion = [
      { id: 'one', location: '马累·海边', locationRegion: '马尔代夫' },
      { id: 'two', location: '马累·老城', locationRegion: '马尔代夫' },
      { id: 'three', location: '未知山谷' },
    ];
    const options = buildLocationOptions(photosWithUnknownRegion);
    expect(options.find((option) => option.id === '马尔代夫')).toMatchObject({ label: '马尔代夫', count: 2 });
    expect(options.find((option) => option.label === '未知山谷')).toMatchObject({ count: 1 });
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

  it('uses the raw region when a display address omits the province prefix', () => {
    const photosWithHiddenPrefix = [{ location: '雁门关', locationId: 'photo-yanmen', locationName: '雁门关景区', locationRegion: '山西省' }];
    const options = buildLocationOptions(photosWithHiddenPrefix);
    expect(options.find((option) => option.id === 'shanxi')).toMatchObject({ available: true, count: 1 });
    expect(options.filter((option) => option.group === 'other')).toHaveLength(0);
    expect(filterPhotosByLocation(photosWithHiddenPrefix, 'shanxi')).toHaveLength(1);
  });
});
