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
});
