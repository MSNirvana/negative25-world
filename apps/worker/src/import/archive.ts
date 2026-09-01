import { unzipSync } from 'fflate';

export type ArchiveEntry = { path: string; uncompressedSize: number };
export type ArchiveLimits = { maxFiles?: number; maxUncompressedBytes?: number };
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.csv', '.json']);

export function validateArchiveEntries(entries: readonly ArchiveEntry[], limits: ArchiveLimits = {}): void {
  const maxFiles = limits.maxFiles ?? 10_000;
  const maxBytes = limits.maxUncompressedBytes ?? 2 * 1024 * 1024 * 1024;
  if (entries.length > maxFiles) throw new Error(`Archive contains too many files (max ${maxFiles})`);
  let total = 0;
  for (const entry of entries) {
    const path = entry.path.replaceAll('\\', '/');
    if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').some((part) => part === '..')) throw new Error(`Unsafe archive path: ${entry.path}`);
    const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.has(extension)) throw new Error(`Unsupported archive file: ${entry.path}`);
    if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) throw new Error(`Invalid archive size: ${entry.path}`);
    total += entry.uncompressedSize;
    if (total > maxBytes) throw new Error(`Archive exceeds uncompressed size limit (${maxBytes} bytes)`);
  }
}

export function extractSafeArchive(input: Uint8Array, limits: ArchiveLimits = {}): Record<string, Uint8Array> {
  const files = unzipSync(input);
  const entries = Object.entries(files).map(([path, body]) => ({ path, uncompressedSize: body.byteLength }));
  validateArchiveEntries(entries, limits);
  return files;
}
