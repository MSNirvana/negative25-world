export type ManifestMatch = { sourceKey: string; filename?: string; fields?: Record<string, unknown> };

export function normalizeRelativePath(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/^\.\//, '').split('/').filter(Boolean).join('/').toLowerCase();
}

export function matchManifest(sourcePath: string, records: readonly ManifestMatch[]): { record?: ManifestMatch; ambiguous: boolean; reason?: string } {
  const normalizedPath = normalizeRelativePath(sourcePath);
  const exact = records.filter((record) => normalizeRelativePath(record.sourceKey) === normalizedPath);
  if (exact.length === 1) return { record: exact[0], ambiguous: false };
  if (exact.length > 1) return { ambiguous: true, reason: 'Multiple manifest rows match the same path' };
  const filename = normalizedPath.split('/').pop();
  const byFilename = records.filter((record) => normalizeRelativePath(record.filename ?? record.sourceKey).split('/').pop() === filename);
  if (byFilename.length === 1) return { record: byFilename[0], ambiguous: false };
  if (byFilename.length > 1) return { ambiguous: true, reason: 'Multiple manifest rows match the same filename' };
  return { ambiguous: false, reason: 'No manifest row matched' };
}

export function duplicateByChecksum(checksums: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const checksum of checksums) {
    if (seen.has(checksum)) duplicates.add(checksum);
    seen.add(checksum);
  }
  return duplicates;
}
