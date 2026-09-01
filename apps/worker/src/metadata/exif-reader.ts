import exifr from 'exifr';

export type ExifReadResult = { fields: Record<string, unknown>; warnings: string[] };

function localTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : undefined;
}

export function capturedTimestamp(value: unknown, offset: unknown): { local: string; utc: string } | undefined {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return { local: value.toISOString().slice(0, 19), utc: value.toISOString() };
  const local = localTimestamp(value);
  if (!local) return undefined;
  const timezone = typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset.trim()) ? offset.trim() : 'Z';
  const date = new Date(`${local}${timezone}`);
  return Number.isNaN(date.valueOf()) ? undefined : { local, utc: date.toISOString() };
}

export async function readExif(input: Uint8Array): Promise<ExifReadResult> {
  const warnings: string[] = [];
  let raw: Record<string, unknown> | undefined;
  try {
    raw = await exifr.parse(input, { tiff: true, exif: true, gps: true, xmp: true, translateValues: true, reviveValues: false }) as Record<string, unknown> | undefined;
  } catch {
    return { fields: {}, warnings: ['Unable to read EXIF metadata'] };
  }
  if (!raw) return { fields: {}, warnings: ['No EXIF metadata found'] };
  const fields: Record<string, unknown> = {};
  const captured = capturedTimestamp(raw.DateTimeOriginal ?? raw.CreateDate ?? raw.ModifyDate, raw.OffsetTimeOriginal ?? raw.OffsetTime);
  if (captured) { fields.capturedAtLocal = captured.local; fields.capturedAt = captured.utc; }
  const mappings: Record<string, string> = { Make: 'cameraMake', Model: 'cameraModel', LensModel: 'lens', FocalLength: 'focalLength', FNumber: 'aperture', ExposureTime: 'shutterSpeed', ISO: 'iso', ImageWidth: 'width', ImageHeight: 'height', latitude: 'latitude', longitude: 'longitude', GPSAltitude: 'altitude', Rating: 'rating', rating: 'rating', 'XMP:Rating': 'rating', 'XMP:rating': 'rating', xmpRating: 'rating' };
  for (const [source, target] of Object.entries(mappings)) if (raw[source] !== undefined && raw[source] !== null) fields[target] = raw[source];
  const altitude = numberValue(fields.altitude);
  if (altitude !== undefined) fields.altitude = belowSeaLevel(raw.GPSAltitudeRef) ? -Math.abs(altitude) : Math.abs(altitude);
  const rating = numberValue(fields.rating);
  if (fields.rating !== undefined && (rating === undefined || !Number.isInteger(rating) || rating < 0 || rating > 7)) {
    delete fields.rating;
    warnings.push('EXIF rating must be an integer from 0 to 7');
  } else if (rating !== undefined) fields.rating = rating;
  if (fields.latitude !== undefined && (Number(fields.latitude) < -90 || Number(fields.latitude) > 90)) { delete fields.latitude; warnings.push('EXIF latitude is out of range'); }
  if (fields.longitude !== undefined && (Number(fields.longitude) < -180 || Number(fields.longitude) > 180)) { delete fields.longitude; warnings.push('EXIF longitude is out of range'); }
  return { fields, warnings };
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function belowSeaLevel(value: unknown): boolean {
  if (value === 1 || value === '1') return true;
  return typeof value === 'string' && /below|below sea|negative/i.test(value);
}
