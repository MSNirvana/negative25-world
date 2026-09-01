import { describe, expect, it } from 'vitest';
import { LocationService } from './location.service.js';

describe('location service', () => {
  it('starts without demo locations', () => {
    const service = new LocationService();

    expect(service.list()).toEqual([]);
    expect(service.nearby({ latitude: 39.9042, longitude: 116.4074 })).toEqual([]);
    expect(service.faraway({ latitude: 39.9042, longitude: 116.4074 })).toEqual([]);
  });
});
