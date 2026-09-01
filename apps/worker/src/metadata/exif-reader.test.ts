import exifr from 'exifr';
import { describe, expect, it, vi } from 'vitest';
import { capturedTimestamp, readExif } from './exif-reader.js';

vi.mock('exifr', () => ({ default: { parse: vi.fn() } }));

describe('EXIF reader', () => {
  it('returns a field-level warning when metadata is absent', async () => {
    const result = await readExif(new Uint8Array([1, 2, 3]));
    expect(result.fields).toEqual({});
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('keeps EXIF date values as local time and applies the original offset', async () => {
    expect(capturedTimestamp('2026:08:11 13:38:13', '+08:00')).toEqual({ local: '2026-08-11T13:38:13', utc: '2026-08-11T05:38:13.000Z' });
    expect(capturedTimestamp(new Date('2026-08-11T05:38:13.000Z'), undefined)).toEqual({ local: '2026-08-11T05:38:13', utc: '2026-08-11T05:38:13.000Z' });
  });

  it('reads altitude and a valid seven-star rating', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({ GPSAltitude: 18.4, GPSAltitudeRef: 1, Rating: 7, latitude: 31.23, longitude: 121.47 });
    const result = await readExif(new Uint8Array([1]));
    expect(result.fields).toMatchObject({ altitude: -18.4, rating: 7, latitude: 31.23, longitude: 121.47 });
    expect(result.warnings).toEqual([]);
  });

  it('drops ratings outside the seven-star range', async () => {
    vi.mocked(exifr.parse).mockResolvedValueOnce({ Rating: 8 });
    const result = await readExif(new Uint8Array([1]));
    expect(result.fields).not.toHaveProperty('rating');
    expect(result.warnings).toContain('EXIF rating must be an integer from 0 to 7');
  });
});
