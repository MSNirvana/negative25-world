import { parse } from 'csv-parse/sync';

export type ManifestRecord = Record<string, unknown> & { sourceKey: string };
const requiredHeader = 'sourceKey';

function normalizeRecord(record: Record<string, unknown>): ManifestRecord {
  const sourceKey = String(record.sourceKey ?? record.path ?? record.filename ?? '').trim();
  if (!sourceKey) throw new Error('Manifest row is missing sourceKey');
  return { ...record, sourceKey };
}

export function readJsonManifest(input: string | Uint8Array): ManifestRecord[] {
  const parsed: unknown = JSON.parse(typeof input === 'string' ? input : new TextDecoder().decode(input));
  if (!Array.isArray(parsed)) throw new Error('JSON manifest must be an array of records');
  return parsed.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('JSON manifest records must be objects');
    return normalizeRecord(record as Record<string, unknown>);
  });
}

export function readCsvManifest(input: string | Uint8Array): ManifestRecord[] {
  const rows = parse(typeof input === 'string' ? input : new TextDecoder().decode(input), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: false, trim: true }) as Record<string, unknown>[];
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  if (!headers.includes(requiredHeader) && !headers.includes('path') && !headers.includes('filename')) throw new Error('CSV manifest must include sourceKey, path, or filename');
  return rows.map(normalizeRecord);
}

export function readManifest(input: string | Uint8Array, format: 'csv' | 'json'): ManifestRecord[] {
  return format === 'csv' ? readCsvManifest(input) : readJsonManifest(input);
}
