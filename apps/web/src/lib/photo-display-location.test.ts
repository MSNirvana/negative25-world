import { describe, expect, it } from 'vitest';
import { cleanRegionName, formatPhotoDisplayLocation } from './photo-display-location';

describe('photo display location', () => {
  it('cleans Chinese administrative suffixes and ignores China', () => {
    expect(cleanRegionName('山西省')).toBe('山西');
    expect(cleanRegionName('广西壮族自治区')).toBe('广西');
    expect(cleanRegionName('香港特别行政区')).toBe('香港');
    expect(cleanRegionName('中国')).toBe('');
  });

  it('formats a region prefix only when explicitly enabled', () => {
    expect(formatPhotoDisplayLocation({ standardName: '标准地点', displayAddress: '鹳雀楼', displayRegion: '山西省', displayRegionEnabled: true })).toBe('山西·鹳雀楼');
    expect(formatPhotoDisplayLocation({ standardName: '山西灵石王家大院售票处', displayAddress: '王家大院', displayRegion: '山西省', displayRegionEnabled: true })).toBe('山西·王家大院');
    expect(formatPhotoDisplayLocation({ displayAddress: '鹳雀楼', displayRegion: '山西', displayRegionEnabled: false })).toBe('鹳雀楼');
    expect(formatPhotoDisplayLocation({ displayAddress: '山西·鹳雀楼', displayRegion: '山西', displayRegionEnabled: true })).toBe('山西·鹳雀楼');
  });

  it('falls back to the standard location and then the empty label', () => {
    expect(formatPhotoDisplayLocation({ standardName: '标准地点' })).toBe('标准地点');
    expect(formatPhotoDisplayLocation({}, '未指定')).toBe('未指定');
  });
});
