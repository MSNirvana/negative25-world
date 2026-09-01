import { describe, expect, it } from 'vitest';
import { haversineDistanceKm, normalizeLongitude, orderByDistance } from './geo.js';

describe('geospatial helpers', () => {
  it('calculates a known distance and handles antimeridian longitude', () => {
    expect(Math.round(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }))).toBe(111);
    expect(Math.round(haversineDistanceKm({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 }))).toBe(111);
    expect(normalizeLongitude(540)).toBe(180);
  });

  it('orders points without mutating the source', () => {
    const points = [{ latitude: 0, longitude: 5 }, { latitude: 0, longitude: 1 }];
    expect(orderByDistance({ latitude: 0, longitude: 0 }, points).map((point) => point.longitude)).toEqual([1, 5]);
    expect(points[0]?.longitude).toBe(5);
  });
});
