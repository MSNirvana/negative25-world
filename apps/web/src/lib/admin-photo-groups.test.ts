import { describe, expect, it } from 'vitest';
import { groupAdminPhotos } from './admin-photo-groups';
import type { AdminPhoto } from '../api/client';

function photo(id: string, importBatch?: AdminPhoto['importBatch']): AdminPhoto {
  return { id, workspaceId: 'space', title: id, description: '', published: false, hidden: false, rating: null, location: null, importBatch };
}

describe('groupAdminPhotos', () => {
  it('keeps the API order while grouping batches and unclassified photos', () => {
    const groups = groupAdminPhotos([
      photo('new-a', { id: 'batch-new', createdAt: '2026-09-02T10:00:00.000Z' }),
      photo('new-b', { id: 'batch-new', createdAt: '2026-09-02T10:00:00.000Z' }),
      photo('old-a', { id: 'batch-old', createdAt: '2026-09-01T10:00:00.000Z' }),
      photo('legacy'),
    ]);

    expect(groups.map((group) => [group.key, group.photos.map((item) => item.id)])).toEqual([
      ['batch-new', ['new-a', 'new-b']],
      ['batch-old', ['old-a']],
      ['unclassified', ['legacy']],
    ]);
  });
});
