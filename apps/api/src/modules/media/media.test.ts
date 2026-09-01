import { describe, expect, it } from 'vitest';
import { ApiError } from '@negative25/utils';
import { calculatePartSize, MediaService } from './media.service.js';
import { MemoryStorageAdapter, S3StorageAdapter } from './storage.js';

const editor = { userId: 'user-1', workspaceId: 'space-1', role: 'editor' as const };

describe('media service', () => {
  it('calculates multipart sizes without exceeding the S3 part limit', () => {
    expect(calculatePartSize(32 * 1024 * 1024)).toBe(16 * 1024 * 1024);
    const size = calculatePartSize(1024 * 1024 * 1024 * 1024);
    expect(size % (8 * 1024 * 1024)).toBe(0);
    expect(Math.ceil((1024 * 1024 * 1024 * 1024) / size)).toBeLessThanOrEqual(9_000);
  });

  it('adds a public path prefix after signing against the public host', async () => {
    const storage = new S3StorageAdapter({ endpoint: 'http://minio:9000', publicEndpoint: 'https://n25.world/storage', bucket: 'negative25', region: 'us-east-1', accessKeyId: 'key', secretAccessKey: 'secret' });
    const url = await storage.createUploadUrl({ key: 'workspaces/space-1/uploads/file.jpg', contentType: 'image/jpeg' });
    expect(new URL(url).pathname).toBe('/storage/negative25/workspaces/space-1/uploads/file.jpg');
  });

  it('creates scoped upload URLs and completes an upload after metadata checks', async () => {
    const storage = new MemoryStorageAdapter();
    const media = new MediaService(storage);
    const upload = await media.createUploadUrl(editor, { filename: 'sunset.jpg', contentType: 'image/jpeg', byteSize: 4 });
    expect(upload.key).toContain('workspaces/space-1/uploads/');
    expect(upload.key).toContain(`/${upload.uploadId}/sunset.jpg`);
    await storage.putObject({ key: upload.key, size: 4, contentType: 'image/jpeg', body: new Uint8Array([1, 2, 3, 4]) });
    const completed = await media.completeUpload(editor, { key: upload.key, expectedByteSize: 4, expectedContentType: 'image/jpeg' });
    expect(completed.status).toBe('uploaded');
  });

  it('normalizes non-ASCII filenames before using them in storage keys', async () => {
    const media = new MediaService(new MemoryStorageAdapter());
    const upload = await media.createUploadUrl(editor, { filename: '旅行照片.jpg', contentType: 'image/jpeg', byteSize: 4 });
    expect(upload.key).toMatch(/\/photo\.jpg$/);
    expect([...upload.key].every((character) => character.charCodeAt(0) <= 0x7f)).toBe(true);
  });

  it('keeps originals private and exposes only preview variants publicly', async () => {
    const storage = new MemoryStorageAdapter();
    const media = new MediaService(storage);
    const preview = await media.getPreviewUrl(null, 'workspaces/space-1/preview/photo.jpg');
    expect(preview).toContain('memory://public');
    await expect(media.getPreviewUrl(null, 'workspaces/space-1/original/photo.jpg')).rejects.toMatchObject({ code: 'UNAUTHORIZED' } satisfies Partial<ApiError>);
  });

  it('rejects an upload object from another workspace', async () => {
    const media = new MediaService(new MemoryStorageAdapter());
    await expect(media.completeUpload(editor, { key: 'workspaces/other/uploads/file.jpg', expectedByteSize: 1, expectedContentType: 'image/jpeg' })).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<ApiError>);
  });

  it('stores binary upload content before completing the reservation', async () => {
    const storage = new MemoryStorageAdapter();
    const media = new MediaService(storage);
    const key = 'workspaces/space-1/uploads/upload-1/sunset.jpg';
    const completed = await media.uploadContent(editor, { key, expectedByteSize: 4, expectedContentType: 'image/jpeg', body: new Uint8Array([1, 2, 3, 4]) });
    expect(completed.sourceKey).toBe(key);
    await expect(storage.headObject(key)).resolves.toMatchObject({ size: 4, contentType: 'image/jpeg' });
  });

  it('supports resumable multipart uploads and verifies each part', async () => {
    const storage = new MemoryStorageAdapter();
    const media = new MediaService(storage);
    const upload = await media.initiateMultipart(editor, { filename: 'large.jpg', contentType: 'image/jpeg', byteSize: 8 });
    expect(upload.partCount).toBe(1);
    await expect(media.getMultipartStatus(editor, upload.id)).resolves.toMatchObject({ parts: [] });
    const etag = await storage.putMultipartPart(upload.storageUploadId, 1, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    await expect(media.getMultipartStatus(editor, upload.id)).resolves.toMatchObject({ parts: [{ partNumber: 1, size: 8, etag }] });
    const completed = await media.completeMultipart(editor, upload.id, [{ partNumber: 1, etag }]);
    expect(completed).toMatchObject({ sourceKey: upload.key, byteSize: 8, status: 'uploaded' });
    await expect(storage.headObject(upload.key)).resolves.toMatchObject({ size: 8, contentType: 'image/jpeg' });
  });

  it('rejects incomplete multipart uploads', async () => {
    const storage = new MemoryStorageAdapter();
    const media = new MediaService(storage);
    const upload = await media.initiateMultipart(editor, { filename: 'large.jpg', contentType: 'image/jpeg', byteSize: 8 });
    const etag = await storage.putMultipartPart(upload.storageUploadId, 1, new Uint8Array([1, 2, 3]));
    await expect(media.completeMultipart(editor, upload.id, [{ partNumber: 1, etag }])).rejects.toMatchObject({ code: 'UPLOAD_METADATA_MISMATCH' } satisfies Partial<ApiError>);
  });
});
