import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { extractSafeArchive, validateArchiveEntries } from './archive.js';

describe('archive safety', () => {
  it('rejects traversal, unsupported files, and oversized batches', () => {
    expect(() => validateArchiveEntries([{ path: '../escape.jpg', uncompressedSize: 1 }])).toThrow(/Unsafe/);
    expect(() => validateArchiveEntries([{ path: 'script.exe', uncompressedSize: 1 }])).toThrow(/Unsupported/);
    expect(() => validateArchiveEntries([{ path: 'big.jpg', uncompressedSize: 10 }], { maxUncompressedBytes: 5 })).toThrow(/size limit/);
  });

  it('extracts an allowed image and manifest', () => {
    const files = extractSafeArchive(zipSync({ 'photos/a.jpg': new Uint8Array([1, 2]), 'manifest.json': new Uint8Array([91, 93]) }));
    expect(Object.keys(files)).toEqual(['photos/a.jpg', 'manifest.json']);
  });
});
