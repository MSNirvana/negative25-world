import { describe, expect, it } from 'vitest';
import {
  AdminSummarySchema,
  AlbumDetailSchema,
  AlbumSummarySchema,
  ApiErrorResponseSchema,
  CursorQuerySchema,
  ImportBatchSummarySchema,
  PhotoSummarySchema,
  overseasRegionForId,
  overseasRegionForLocation,
} from './index.js';

describe('shared API contracts', () => {
  it('accepts the public photo summary shape', () => {
    const photo = PhotoSummarySchema.parse({
      id: 'photo-1',
      spaceSlug: 'primary',
      title: 'A view',
      capturedAt: '2026-01-02T03:04:05.000Z',
      aspectRatio: 1.5,
      thumbnail: { kind: 'thumbnail', url: 'https://cdn.test/t.jpg', width: 300, height: 200, format: 'webp' },
      location: null,
      metadata: {},
    });
    expect(photo.id).toBe('photo-1');
  });

  it('rejects malformed cursors', () => {
    expect(CursorQuerySchema.safeParse({ cursor: 'has spaces' }).success).toBe(false);
  });

  it('models the standard error response', () => {
    expect(ApiErrorResponseSchema.parse({
      error: { code: 'NOT_FOUND', message: 'Photo not found' },
      requestId: 'req-123',
    }).error.code).toBe('NOT_FOUND');
  });

  it('models the workspace Studio summary used by web and iPhone clients', () => {
    const summary = AdminSummarySchema.parse({
      workspace: { id: 'space-1', slug: 'primary', name: 'negative25', role: 'owner' },
      stats: { photoCount: 4, publishedPhotoCount: 3, pendingImportCount: 1 },
      recentActivity: [{ type: 'import', id: 'batch-1', status: 'processing', total: 4, completed: 2, failed: 0, createdAt: '2026-01-02T03:04:05.000Z' }],
    });
    expect(summary.stats.publishedPhotoCount).toBe(3);
  });

  it('models an import history row', () => {
    expect(ImportBatchSummarySchema.parse({ id: 'batch-1', status: 'completed', counts: { total: 2, completed: 2, failed: 0 }, createdAt: '2026-01-02T03:04:05.000Z' }).counts.total).toBe(2);
  });

  it('models public and admin album payloads without leaking storage fields', () => {
    const photo = { id: 'photo-1', spaceSlug: 'primary', title: 'A view', capturedAt: '2026-01-02T03:04:05.000Z', aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://cdn.test/t.jpg', width: 300, height: 200, format: 'webp' }, location: null, metadata: {} };
    expect(AlbumSummarySchema.parse({ id: 'album-1', spaceSlug: 'primary', title: 'First light', shootDate: '2026-01-02', cover: photo, photoCount: 1 }).shootDate).toBe('2026-01-02');
    expect(AlbumDetailSchema.parse({ id: 'album-1', spaceSlug: 'primary', title: 'First light', shootDate: null, cover: photo, photoCount: 1, photos: [photo] }).photos).toHaveLength(1);
  });

  it('normalizes overseas country names and formatted place labels', () => {
    expect(overseasRegionForLocation('新加坡·鱼尾狮')?.id).toBe('singapore');
    expect(overseasRegionForLocation('Marina Bay Sands, Singapore')?.id).toBe('singapore');
    expect(overseasRegionForId('Singapore')?.nameZh).toBe('新加坡');
    expect(overseasRegionForLocation('王家大院')?.id).toBeUndefined();
  });
});
