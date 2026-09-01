export type PhotoMetadata = Record<string, unknown>;
export type MergeInput = { manual?: PhotoMetadata; manifest?: PhotoMetadata; exif?: PhotoMetadata; defaults?: PhotoMetadata };
export type MergeResult = { fields: PhotoMetadata; sources: Record<string, 'manual' | 'manifest' | 'exif' | 'default'>; warnings: string[] };

function hasValue(value: unknown): boolean { return value !== undefined && value !== null && value !== ''; }
function wantsClear(source: MergeResult['sources'][string], value: unknown): boolean {
  if (source === 'manifest') return typeof value === 'object' && value !== null && (value as { clear?: boolean }).clear === true;
  return value === null || (typeof value === 'object' && value !== null && (value as { clear?: boolean }).clear === true);
}
function normalizedValue(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'value' in value ? (value as { value: unknown }).value : value;
}

/** Merge in descending authority while preserving EXIF values for blank manifest cells. */
export function mergeFields(input: MergeInput): MergeResult {
  const fields: PhotoMetadata = {};
  const sources: MergeResult['sources'] = {};
  const warnings: string[] = [];
  const keys = new Set(Object.keys(input.defaults ?? {}).concat(Object.keys(input.exif ?? {}), Object.keys(input.manifest ?? {}), Object.keys(input.manual ?? {})));
  for (const key of keys) {
    const candidates: [MergeResult['sources'][string], unknown][] = [
      ['manual', input.manual?.[key]], ['manifest', input.manifest?.[key]], ['exif', input.exif?.[key]], ['default', input.defaults?.[key]],
    ];
    if (Object.prototype.hasOwnProperty.call(input.manifest ?? {}, key) && !hasValue(input.manifest?.[key]) && !wantsClear('manifest', input.manifest?.[key])) {
      warnings.push(`Manifest field ${key} is empty and was ignored`);
    }
    const selected = candidates.find(([source, value]) => hasValue(value) || wantsClear(source, value));
    if (!selected) continue;
    const [source, rawValue] = selected;
    if (wantsClear(source, rawValue)) {
      fields[key] = null;
    } else {
      fields[key] = normalizedValue(rawValue);
    }
    sources[key] = source;
  }
  return { fields, sources, warnings };
}
