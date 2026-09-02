import { describe, expect, it } from 'vitest';
import { createRepository, dateOnlyString, MemoryRepository, PRIMARY_WORKSPACE_ID } from './repository.js';

describe('repository adapters', () => {
  it('serializes database date values as date-only strings', () => {
    expect(dateOnlyString(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09-01');
    expect(dateOnlyString('2026-09-01')).toBe('2026-09-01');
    expect(dateOnlyString('2026-09-01T00:00:00.000Z')).toBe('2026-09-01');
    expect(dateOnlyString(null)).toBeNull();
  });

  it('uses memory storage unless database mode is explicitly enabled', () => {
    const original = process.env.N25_USE_DATABASE;
    delete process.env.N25_USE_DATABASE;
    const { repository } = createRepository('postgres://invalid.example/negative25');
    expect(repository).toBeInstanceOf(MemoryRepository);
    if (original) process.env.N25_USE_DATABASE = original;
  });

  it('persists refresh tokens and workspace photo visibility in memory', async () => {
    const repository = new MemoryRepository();
    await repository.saveRefreshToken('hash', 'user', new Date(Date.now() + 10000));
    expect(await repository.consumeRefreshToken('hash')).toBe('user');
    expect(await repository.consumeRefreshToken('hash')).toBeUndefined();
    const photo = await repository.findPhoto(PRIMARY_WORKSPACE_ID, 'primary-photo-1');
    expect(photo?.published).toBe(true);
    await repository.updatePhoto('primary-photo-1', PRIMARY_WORKSPACE_ID, { published: false, hidden: true });
    expect((await repository.findPhoto(PRIMARY_WORKSPACE_ID, 'primary-photo-1'))?.published).toBe(false);
  });

  it('finds an account when its public profile is enabled', async () => {
    const repository = new MemoryRepository();
    await repository.saveUser({ id: 'gavin-user', username: 'gavin', email: 'gavin@example.com', name: 'Gavin', passwordHash: 'hash', emailVerifiedAt: null });
    await repository.saveUserProfile({ userId: 'gavin-user', avatarMediaId: null, displayName: 'Gavin', bio: null, location: null, websiteUrl: null, instagramUrl: null, weiboUrl: null, profilePublic: true });
    await repository.saveWorkspace({ id: 'gavin-space', slug: 'u-gavin', name: "Gavin's photography", kind: 'personal', ownerUserId: 'gavin-user', isPublic: false, allowMemberShowcase: true });
    await repository.savePhoto({ id: 'gavin-photo', workspaceId: 'gavin-space', title: 'Published frame', description: '', published: true, hidden: false, rating: null, checksum: 'gavin-checksum', metadata: {} });

    expect(await repository.searchPublicUsers('gavin')).toMatchObject([{ username: 'gavin', displayName: 'Gavin' }]);
    expect(await repository.listPublicPhotosForUser('gavin-user')).toHaveLength(1);
  });

  it('orders photos by their latest completed import batch and keeps legacy photos last', async () => {
    const repository = new MemoryRepository();
    await repository.createBatch({
      id: 'batch-old', workspaceId: PRIMARY_WORKSPACE_ID, actorId: 'owner', status: 'completed', createdAt: '2026-09-01T10:00:00.000Z',
      items: [{ id: 'item-old', sourceKey: 'uploads/old.jpg', status: 'completed', checksum: 'shared', errors: [], warnings: [], resolvedFields: {} }], counts: { total: 1, completed: 1, failed: 0 },
    });
    await repository.createBatch({
      id: 'batch-new', workspaceId: PRIMARY_WORKSPACE_ID, actorId: 'owner', status: 'completed', createdAt: '2026-09-02T10:00:00.000Z',
      items: [
        { id: 'item-new-a', sourceKey: 'uploads/a.jpg', status: 'completed', checksum: 'shared', errors: [], warnings: [], resolvedFields: {} },
        { id: 'item-new-b', sourceKey: 'uploads/b.jpg', status: 'completed', checksum: 'new', errors: [], warnings: [], resolvedFields: {} },
      ], counts: { total: 2, completed: 2, failed: 0 },
    });
    await repository.savePhoto({ id: 'photo-shared', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Shared', description: '', published: false, hidden: false, rating: null, checksum: 'shared' });
    await repository.savePhoto({ id: 'photo-new', workspaceId: PRIMARY_WORKSPACE_ID, title: 'New', description: '', published: false, hidden: false, rating: null, checksum: 'new' });
    await repository.savePhoto({ id: 'photo-legacy', workspaceId: PRIMARY_WORKSPACE_ID, title: 'Legacy', description: '', published: false, hidden: false, rating: null, checksum: 'legacy' });

    const photos = await repository.listPhotos(PRIMARY_WORKSPACE_ID, { includeImportBatch: true });

    expect(photos.map((photo) => photo.id)).toEqual(['photo-shared', 'photo-new', 'photo-legacy', 'primary-photo-1']);
    expect(photos[0]?.importBatch).toMatchObject({ id: 'batch-new', sourceKey: 'uploads/a.jpg' });
    expect(photos[1]?.importBatch).toMatchObject({ id: 'batch-new', sourceKey: 'uploads/b.jpg' });
    expect(photos[2]).not.toHaveProperty('importBatch');
  });
});
