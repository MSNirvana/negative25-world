import { describe, expect, it } from 'vitest';
import { formatCoordinate, parseCoordinate, parseCoordinatePair } from './admin-location-coordinates';

describe('admin location coordinates', () => {
  it('parses decimal coordinate input without changing intermediate text', () => {
    expect(parseCoordinate(' 103.8198 ')).toBe(103.8198);
    expect(parseCoordinate('-')).toBeNull();
    expect(parseCoordinate('')).toBeNull();
  });

  it('validates latitude and longitude ranges as a pair', () => {
    expect(parseCoordinatePair('1.3521', '103.8198')).toEqual({ latitude: 1.3521, longitude: 103.8198 });
    expect(parseCoordinatePair('91', '103.8198')).toBeNull();
    expect(parseCoordinatePair('1.3521', '')).toBeNull();
  });

  it('formats values for the editable coordinate fields', () => {
    expect(formatCoordinate(1.3521)).toBe('1.352100');
    expect(formatCoordinate(null)).toBe('');
  });
});
