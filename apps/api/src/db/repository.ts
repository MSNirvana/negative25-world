import postgres, { type Sql } from 'postgres';

// Stable UUIDs keep the in-memory adapter compatible with PostgreSQL's UUID
// foreign keys while preserving deterministic development fixtures.
export const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';
export const PRIMARY_WORKSPACE_ID = '00000000-0000-4000-8000-000000000101';
export const OTHER_WORKSPACE_ID = '00000000-0000-4000-8000-000000000102';

export type UserRecord = { id: string; username?: string; email: string; name: string | null; passwordHash: string; emailVerifiedAt?: Date | null; disabled?: boolean; deletionRequestedAt?: Date | null; deletedAt?: Date | null };
export type UserProfileRecord = { userId: string; avatarMediaId: string | null; displayName: string | null; bio: string | null; location: string | null; websiteUrl: string | null; instagramUrl: string | null; weiboUrl: string | null; profilePublic: boolean };
export type PublicProfileSearchRecord = { username: string; displayName: string | null; bio: string | null; location: string | null; avatarMediaId: string | null };
export type EmailChallengeRecord = { id: string; userId: string; purpose: 'verify_email' | 'reset_password' | 'change_email'; tokenHash: string; codeHash: string | null; expiresAt: Date; attempts: number; consumedAt: Date | null };
export type WorkspaceRecord = { id: string; slug: string; name: string; kind?: 'personal' | 'collaborative'; ownerUserId?: string | null; isPublic?: boolean; allowMemberShowcase?: boolean };
export type MembershipRecord = { workspaceId: string; userId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type WorkspaceMemberRecord = { userId: string; email: string; name: string | null; role: MembershipRecord['role'] };
export type AccessibleWorkspaceRecord = WorkspaceRecord & { role: MembershipRecord['role'] };
export type WorkspaceSummaryRecord = {
  photoCount: number;
  publishedPhotoCount: number;
  pendingImportCount: number;
  recentActivity: Array<{ type: 'import'; id: string; status: string; total: number; completed: number; failed: number; createdAt: string }>;
};
export type ImportBatchSummaryRecord = { id: string; workspaceId: string; status: string; counts: { total: number; completed: number; failed: number }; createdAt: string; publishedCount?: number };
export type PhotoLocationRecord = { id: string; name: string };
export type PhotoRecord = { id: string; workspaceId: string; title: string; description: string; published: boolean; hidden: boolean; ownerOnly?: boolean; rating: number | null; checksum?: string; spaceSlug?: string; capturedAt?: string; aspectRatio?: number; thumbnail?: unknown; media?: unknown[]; location?: PhotoLocationRecord | null; latitude?: number; longitude?: number; metadata?: Record<string, unknown> };
export type AlbumRecord = { id: string; workspaceId: string; spaceSlug?: string; title: string; description?: string; shootDate?: string | null; coverPhotoId: string | null; sortOrder: number; photoIds: string[] };
export type BatchItem = { id: string; sourceKey: string; status: string; checksum?: string; errors: string[]; warnings: string[]; resolvedFields: Record<string, unknown> };
export type BatchRecord = { id: string; workspaceId: string; actorId: string; status: string; idempotencyKey?: string; items: BatchItem[]; counts: { total: number; completed: number; failed: number }; publishedCount?: number; createdAt?: string };
export type MediaUploadStatus = 'initiated' | 'completed' | 'aborted' | 'expired';
export type MediaUploadRecord = {
  id: string;
  workspaceId: string;
  createdBy: string;
  storageKey: string;
  storageUploadId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  checksum?: string | null;
  partSize: number;
  partCount: number;
  status: MediaUploadStatus;
  expiresAt: Date;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export function isPhotoOwnerOnly(photo: Pick<PhotoRecord, 'ownerOnly' | 'metadata'>): boolean {
  return photo.ownerOnly === true || photo.metadata?.ownerOnly === true;
}

export function isPhotoPublic(photo: Pick<PhotoRecord, 'published' | 'hidden' | 'ownerOnly' | 'metadata'>): boolean {
  return photo.published && !photo.hidden && !isPhotoOwnerOnly(photo);
}

export interface AppRepository {
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserByUsername(username: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  saveUser(user: UserRecord): Promise<void>;
  updateUser(id: string, patch: Partial<Pick<UserRecord, 'username' | 'email' | 'name' | 'passwordHash' | 'emailVerifiedAt' | 'disabled' | 'deletionRequestedAt' | 'deletedAt'>>): Promise<UserRecord | undefined>;
  findUserProfile(userId: string): Promise<UserProfileRecord | undefined>;
  searchPublicUsers(query: string, limit?: number): Promise<PublicProfileSearchRecord[]>;
  listPublicPhotosForUser(userId: string): Promise<PhotoRecord[]>;
  saveUserProfile(profile: UserProfileRecord): Promise<void>;
  saveEmailChallenge(challenge: EmailChallengeRecord): Promise<void>;
  findEmailChallengeByTokenHash(tokenHash: string, purpose: EmailChallengeRecord['purpose']): Promise<EmailChallengeRecord | undefined>;
  findLatestEmailChallenge(userId: string, purpose: EmailChallengeRecord['purpose']): Promise<EmailChallengeRecord | undefined>;
  updateEmailChallenge(id: string, patch: Partial<Pick<EmailChallengeRecord, 'attempts' | 'consumedAt'>>): Promise<void>;
  saveRefreshToken(hash: string, userId: string, expiresAt: Date): Promise<void>;
  consumeRefreshToken(hash: string): Promise<string | undefined>;
  revokeRefreshToken(hash: string): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;
  listWorkspaces(): Promise<WorkspaceRecord[]>;
  listWorkspacesForUser(userId: string): Promise<AccessibleWorkspaceRecord[]>;
  saveWorkspace(workspace: WorkspaceRecord): Promise<WorkspaceRecord>;
  findWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | undefined>;
  findMembership(workspaceId: string, userId: string): Promise<MembershipRecord | undefined>;
  listMemberships(workspaceId: string): Promise<MembershipRecord[]>;
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]>;
  saveMembership(membership: MembershipRecord): Promise<void>;
  updateMembershipRole(workspaceId: string, userId: string, role: MembershipRecord['role']): Promise<boolean>;
  listPhotos(workspaceId: string): Promise<PhotoRecord[]>;
  findPhoto(workspaceId: string, id: string): Promise<PhotoRecord | undefined>;
  savePhoto(photo: PhotoRecord): Promise<void>;
  updatePhoto(id: string, workspaceId: string, patch: Partial<PhotoRecord>): Promise<PhotoRecord | undefined>;
  listAlbums(workspaceId: string, publishedOnly?: boolean): Promise<AlbumRecord[]>;
  findAlbum(workspaceId: string, albumId: string, publishedOnly?: boolean): Promise<AlbumRecord | undefined>;
  saveAlbum(album: AlbumRecord): Promise<AlbumRecord>;
  updateAlbum(id: string, workspaceId: string, patch: Partial<Pick<AlbumRecord, 'title' | 'description' | 'shootDate' | 'coverPhotoId' | 'sortOrder'>>): Promise<AlbumRecord | undefined>;
  deleteAlbum(id: string, workspaceId: string): Promise<boolean>;
  setAlbumPhotos(id: string, workspaceId: string, photoIds: string[]): Promise<AlbumRecord | undefined>;
  getWorkspaceSummary(workspaceId: string): Promise<WorkspaceSummaryRecord>;
  listImportBatches(workspaceId: string): Promise<ImportBatchSummaryRecord[]>;
  publishBatchPhotos(batchId: string, workspaceId: string): Promise<number>;
  createBatch(batch: BatchRecord): Promise<BatchRecord>;
  findBatchByIdempotency(workspaceId: string, key: string): Promise<BatchRecord | undefined>;
  findBatch(id: string, workspaceId: string): Promise<BatchRecord | undefined>;
  saveBatch(batch: BatchRecord): Promise<void>;
  createMediaUpload(upload: MediaUploadRecord): Promise<MediaUploadRecord>;
  findMediaUpload(id: string, workspaceId: string): Promise<MediaUploadRecord | undefined>;
  updateMediaUpload(id: string, workspaceId: string, patch: Partial<Pick<MediaUploadRecord, 'status' | 'completedAt'>>): Promise<MediaUploadRecord | undefined>;
  listExpiredMediaUploads(now?: Date): Promise<MediaUploadRecord[]>;
}

export class MemoryRepository implements AppRepository {
  readonly users = new Map<string, UserRecord>();
  readonly profiles = new Map<string, UserProfileRecord>();
  readonly emailChallenges = new Map<string, EmailChallengeRecord>();
  readonly refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
  readonly workspaces: WorkspaceRecord[] = [{ id: PRIMARY_WORKSPACE_ID, slug: 'primary', name: 'negative25' }, { id: OTHER_WORKSPACE_ID, slug: 'other', name: 'Field notes' }];
  readonly memberships = new Map<string, MembershipRecord>();
  readonly photos = new Map<string, PhotoRecord>([['primary-photo-1', { id: 'primary-photo-1', workspaceId: PRIMARY_WORKSPACE_ID, title: 'negative25', description: '', published: true, hidden: false, rating: null, spaceSlug: 'primary', capturedAt: '2026-01-02T03:04:05.000Z', aspectRatio: 1.5, thumbnail: { kind: 'thumbnail', url: 'https://cdn.invalid/primary-photo-1.jpg', width: 300, height: 200, format: 'jpeg' }, media: [], location: null, metadata: {} }]]);
  readonly batches = new Map<string, BatchRecord>();
  readonly mediaUploads = new Map<string, MediaUploadRecord>();
  readonly albums = new Map<string, AlbumRecord>();
  async findUserByEmail(email: string) { return [...this.users.values()].find((user) => user.email === email); }
  async findUserByUsername(username: string) { return [...this.users.values()].find((user) => user.username?.toLowerCase() === username.toLowerCase()); }
  async findUserById(id: string) { return this.users.get(id); }
  async saveUser(user: UserRecord) { this.users.set(user.id, user); }
  async updateUser(id: string, patch: Partial<Pick<UserRecord, 'username' | 'email' | 'name' | 'passwordHash' | 'emailVerifiedAt' | 'disabled' | 'deletionRequestedAt' | 'deletedAt'>>) { const user = this.users.get(id); if (!user) return undefined; const updated = { ...user, ...patch }; this.users.set(id, updated); return updated; }
  async findUserProfile(userId: string) { return this.profiles.get(userId); }
  async searchPublicUsers(query: string, limit = 20) {
    const needle = query.trim().toLowerCase();
    const candidates = [...this.users.values()].map((user) => ({ user, profile: this.profiles.get(user.id) }));
    return candidates
      // Published photos make an account discoverable; private drafts do not.
      .filter(({ user, profile }) => Boolean(user.username && profile?.profilePublic && (user.username.toLowerCase().includes(needle) || profile.displayName?.toLowerCase().includes(needle))))
      .slice(0, limit)
      .map(({ user, profile }) => ({ username: user.username as string, displayName: profile?.displayName ?? null, bio: profile?.bio ?? null, location: profile?.location ?? null, avatarMediaId: profile?.avatarMediaId ?? null }));
  }
  async listPublicPhotosForUser(userId: string) {
    const owned = this.workspaces.filter((workspace) => workspace.ownerUserId === userId && workspace.kind === 'personal');
    return (await Promise.all(owned.map((workspace) => this.listPhotos(workspace.id)))).flat().filter(isPhotoPublic);
  }
  async saveUserProfile(profile: UserProfileRecord) { this.profiles.set(profile.userId, { ...profile }); }
  async saveEmailChallenge(challenge: EmailChallengeRecord) { this.emailChallenges.set(challenge.id, { ...challenge }); }
  async findEmailChallengeByTokenHash(tokenHash: string, purpose: EmailChallengeRecord['purpose']) { return [...this.emailChallenges.values()].find((challenge) => challenge.tokenHash === tokenHash && challenge.purpose === purpose && !challenge.consumedAt); }
  async findLatestEmailChallenge(userId: string, purpose: EmailChallengeRecord['purpose']) { return [...this.emailChallenges.values()].filter((challenge) => challenge.userId === userId && challenge.purpose === purpose && !challenge.consumedAt).sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0]; }
  async updateEmailChallenge(id: string, patch: Partial<Pick<EmailChallengeRecord, 'attempts' | 'consumedAt'>>) { const challenge = this.emailChallenges.get(id); if (challenge) this.emailChallenges.set(id, { ...challenge, ...patch }); }
  async saveRefreshToken(hash: string, userId: string, expiresAt: Date) { this.refreshTokens.set(hash, { userId, expiresAt }); }
  async consumeRefreshToken(hash: string) { const value = this.refreshTokens.get(hash); this.refreshTokens.delete(hash); return value && value.expiresAt > new Date() ? value.userId : undefined; }
  async revokeRefreshToken(hash: string) { this.refreshTokens.delete(hash); }
  async revokeAllRefreshTokens(userId: string) { for (const [hash, value] of this.refreshTokens) if (value.userId === userId) this.refreshTokens.delete(hash); }
  async listWorkspaces() { return [...this.workspaces]; }
  async listWorkspacesForUser(userId: string) {
    return this.workspaces.flatMap((workspace) => {
      const membership = this.memberships.get(`${workspace.id}:${userId}`);
      return membership ? [{ ...workspace, role: membership.role }] : [];
    });
  }
  async saveWorkspace(workspace: WorkspaceRecord) {
    const existing = this.workspaces.find((item) => item.slug === workspace.slug);
    if (existing) return existing;
    this.workspaces.push(workspace);
    return workspace;
  }
  async findWorkspaceBySlug(slug: string) { return this.workspaces.find((workspace) => workspace.slug === slug); }
  async findMembership(workspaceId: string, userId: string) { return this.memberships.get(`${workspaceId}:${userId}`); }
  async listMemberships(workspaceId: string) { return [...this.memberships.values()].filter((membership) => membership.workspaceId === workspaceId).map((membership) => ({ ...membership })); }
  async listWorkspaceMembers(workspaceId: string) {
    return [...this.memberships.values()]
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership) => { const user = this.users.get(membership.userId); return { userId: membership.userId, email: user?.email ?? 'Unknown user', name: user?.name ?? null, role: membership.role }; });
  }
  async saveMembership(value: MembershipRecord) { this.memberships.set(`${value.workspaceId}:${value.userId}`, value); }
  async updateMembershipRole(workspaceId: string, userId: string, role: MembershipRecord['role']) { const membership = this.memberships.get(`${workspaceId}:${userId}`); if (!membership) return false; membership.role = role; return true; }
  async listPhotos(workspaceId: string) { return [...this.photos.values()].filter((photo) => photo.workspaceId === workspaceId).map((photo) => ({ ...photo })); }
  async findPhoto(workspaceId: string, id: string) { const photo = this.photos.get(id); return photo?.workspaceId === workspaceId ? { ...photo } : undefined; }
  async savePhoto(photo: PhotoRecord) { this.photos.set(photo.id, { ...photo }); }
  async updatePhoto(id: string, workspaceId: string, patch: Partial<PhotoRecord>) { const photo = await this.findPhoto(workspaceId, id); if (!photo) return undefined; const updated = { ...photo, ...patch }; await this.savePhoto(updated); return updated; }
  async listAlbums(workspaceId: string, publishedOnly = false) {
    return [...this.albums.values()]
      .filter((album) => album.workspaceId === workspaceId)
      .map((album) => ({ ...album, photoIds: [...album.photoIds] }))
      .map((album) => publishedOnly ? { ...album, photoIds: album.photoIds.filter((id) => { const photo = this.photos.get(id); return Boolean(photo && isPhotoPublic(photo)); }) } : album)
      .filter((album) => !publishedOnly || album.photoIds.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  async findAlbum(workspaceId: string, albumId: string, publishedOnly = false) {
    const album = [...this.albums.values()].find((item) => item.workspaceId === workspaceId && item.id === albumId);
    if (!album) return undefined;
    const result = { ...album, photoIds: [...album.photoIds] };
    if (publishedOnly) {
      result.photoIds = result.photoIds.filter((id) => { const photo = this.photos.get(id); return Boolean(photo && isPhotoPublic(photo)); });
      if (!result.photoIds.length) return undefined;
    }
    return result;
  }
  async saveAlbum(album: AlbumRecord) { const spaceSlug = album.spaceSlug ?? this.workspaces.find((workspace) => workspace.id === album.workspaceId)?.slug; const stored = { ...album, ...(spaceSlug ? { spaceSlug } : {}), photoIds: [...album.photoIds] }; this.albums.set(album.id, stored); return stored; }
  async updateAlbum(id: string, workspaceId: string, patch: Partial<Pick<AlbumRecord, 'title' | 'description' | 'shootDate' | 'coverPhotoId' | 'sortOrder'>>) { const album = await this.findAlbum(workspaceId, id); if (!album) return undefined; const updated = { ...album, ...patch }; await this.saveAlbum(updated); return updated; }
  async deleteAlbum(id: string, workspaceId: string) { const album = await this.findAlbum(workspaceId, id); if (!album) return false; return this.albums.delete(album.id); }
  async setAlbumPhotos(id: string, workspaceId: string, photoIds: string[]) { const album = await this.findAlbum(workspaceId, id); if (!album) return undefined; const updated = { ...album, photoIds: [...new Set(photoIds)] }; await this.saveAlbum(updated); return updated; }
  async getWorkspaceSummary(workspaceId: string): Promise<WorkspaceSummaryRecord> {
    const photos = [...this.photos.values()].filter((photo) => photo.workspaceId === workspaceId);
    const batches = [...this.batches.values()].filter((batch) => batch.workspaceId === workspaceId);
    const pendingStatuses = new Set(['uploaded', 'preview', 'queued', 'processing']);
    return {
      photoCount: photos.length,
      publishedPhotoCount: photos.filter((photo) => photo.published && !photo.hidden).length,
      pendingImportCount: batches.filter((batch) => pendingStatuses.has(batch.status)).length,
      recentActivity: batches.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))).slice(0, 5).map((batch) => ({ type: 'import' as const, id: batch.id, status: batch.status, total: batch.counts.total, completed: batch.counts.completed, failed: batch.counts.failed, createdAt: batch.createdAt ?? new Date(0).toISOString() })),
    };
  }
  async listImportBatches(workspaceId: string): Promise<ImportBatchSummaryRecord[]> {
    return [...this.batches.values()]
      .filter((batch) => batch.workspaceId === workspaceId)
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .map((batch) => ({ id: batch.id, workspaceId, status: batch.status, counts: { ...batch.counts }, publishedCount: publishedPhotoCount(batch, this.photos), createdAt: batch.createdAt ?? new Date(0).toISOString() }));
  }
  async publishBatchPhotos(batchId: string, workspaceId: string): Promise<number> {
    const batch = this.batches.get(batchId);
    if (!batch || batch.workspaceId !== workspaceId) return 0;
    const checksums = new Set(batch.items.filter((item) => item.status === 'completed' && item.checksum).map((item) => item.checksum as string));
    let published = 0;
    for (const photo of this.photos.values()) {
      if (photo.workspaceId !== workspaceId || !photo.checksum || !checksums.has(photo.checksum)) continue;
      photo.published = true;
      photo.hidden = false;
      published += 1;
    }
    return published;
  }
  async createBatch(batch: BatchRecord) { this.batches.set(batch.id, batch); return batch; }
  async findBatchByIdempotency(workspaceId: string, key: string) { return [...this.batches.values()].find((batch) => batch.workspaceId === workspaceId && batch.idempotencyKey === key); }
  async findBatch(id: string, workspaceId: string) { const batch = this.batches.get(id); return batch?.workspaceId === workspaceId ? { ...batch, publishedCount: publishedPhotoCount(batch, this.photos) } : undefined; }
  async saveBatch(batch: BatchRecord) { this.batches.set(batch.id, batch); }
  async createMediaUpload(upload: MediaUploadRecord) { const stored = { ...upload }; this.mediaUploads.set(upload.id, stored); return { ...stored }; }
  async findMediaUpload(id: string, workspaceId: string) { const upload = this.mediaUploads.get(id); return upload?.workspaceId === workspaceId ? { ...upload } : undefined; }
  async updateMediaUpload(id: string, workspaceId: string, patch: Partial<Pick<MediaUploadRecord, 'status' | 'completedAt'>>) {
    const upload = await this.findMediaUpload(id, workspaceId);
    if (!upload) return undefined;
    const updated = { ...upload, ...patch, updatedAt: new Date() };
    this.mediaUploads.set(id, updated);
    return { ...updated };
  }
  async listExpiredMediaUploads(now = new Date()) { return [...this.mediaUploads.values()].filter((upload) => upload.status === 'initiated' && upload.expiresAt <= now).map((upload) => ({ ...upload })); }
}

function publishedPhotoCount(batch: BatchRecord, photos: Map<string, PhotoRecord>): number {
  const checksums = new Set(batch.items.filter((item) => item.status === 'completed' && item.checksum).map((item) => item.checksum as string));
  let count = 0;
  for (const photo of photos.values()) {
    if (photo.workspaceId === batch.workspaceId && photo.published && photo.checksum && checksums.has(photo.checksum)) count += 1;
  }
  return count;
}

export class PostgresRepository implements AppRepository {
  constructor(private readonly db: Sql) {}
  async findUserByEmail(email: string) { const rows = await this.db`SELECT id, username, email, name, password_hash AS "passwordHash", email_verified_at AS "emailVerifiedAt", disabled, deletion_requested_at AS "deletionRequestedAt", deleted_at AS "deletedAt" FROM users WHERE email = ${email.toLowerCase()} AND deleted_at IS NULL LIMIT 1`; return rows[0] as UserRecord | undefined; }
  async findUserByUsername(username: string) { const rows = await this.db`SELECT id, username, email, name, password_hash AS "passwordHash", email_verified_at AS "emailVerifiedAt", disabled, deletion_requested_at AS "deletionRequestedAt", deleted_at AS "deletedAt" FROM users WHERE lower(username) = ${username.toLowerCase()} AND deleted_at IS NULL LIMIT 1`; return rows[0] as UserRecord | undefined; }
  async findUserById(id: string) { const rows = await this.db`SELECT id, username, email, name, password_hash AS "passwordHash", email_verified_at AS "emailVerifiedAt", disabled, deletion_requested_at AS "deletionRequestedAt", deleted_at AS "deletedAt" FROM users WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`; return rows[0] as UserRecord | undefined; }
  async saveUser(user: UserRecord) { const username = user.username ?? user.email.split('@')[0].toLowerCase(); await this.db`INSERT INTO users (id, username, email, name, password_hash, email_verified_at, disabled, deletion_requested_at, deleted_at) VALUES (${user.id}, ${username}, ${user.email.toLowerCase()}, ${user.name}, ${user.passwordHash}, ${user.emailVerifiedAt ?? null}, ${user.disabled ?? false}, ${user.deletionRequestedAt ?? null}, ${user.deletedAt ?? null}) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email, name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, email_verified_at = EXCLUDED.email_verified_at, disabled = EXCLUDED.disabled, deletion_requested_at = EXCLUDED.deletion_requested_at, deleted_at = EXCLUDED.deleted_at, updated_at = now()`; }
  async updateUser(id: string, patch: Partial<Pick<UserRecord, 'username' | 'email' | 'name' | 'passwordHash' | 'emailVerifiedAt' | 'disabled' | 'deletionRequestedAt' | 'deletedAt'>>) {
    const rows = await this.db`UPDATE users SET username = CASE WHEN ${patch.username !== undefined} THEN ${patch.username ?? null} ELSE username END, email = CASE WHEN ${patch.email !== undefined} THEN ${patch.email?.toLowerCase() ?? null} ELSE email END, name = CASE WHEN ${patch.name !== undefined} THEN ${patch.name ?? null} ELSE name END, password_hash = CASE WHEN ${patch.passwordHash !== undefined} THEN ${patch.passwordHash ?? null} ELSE password_hash END, email_verified_at = CASE WHEN ${patch.emailVerifiedAt !== undefined} THEN ${patch.emailVerifiedAt ?? null} ELSE email_verified_at END, disabled = CASE WHEN ${patch.disabled !== undefined} THEN ${patch.disabled ?? false} ELSE disabled END, deletion_requested_at = CASE WHEN ${patch.deletionRequestedAt !== undefined} THEN ${patch.deletionRequestedAt ?? null} ELSE deletion_requested_at END, deleted_at = CASE WHEN ${patch.deletedAt !== undefined} THEN ${patch.deletedAt ?? null} ELSE deleted_at END, updated_at = now() WHERE id = ${id} RETURNING id, username, email, name, password_hash AS "passwordHash", email_verified_at AS "emailVerifiedAt", disabled, deletion_requested_at AS "deletionRequestedAt", deleted_at AS "deletedAt"`;
    return rows[0] as UserRecord | undefined;
  }
  async findUserProfile(userId: string) { const rows = await this.db`SELECT user_id AS "userId", avatar_media_id AS "avatarMediaId", display_name AS "displayName", bio, location, website_url AS "websiteUrl", instagram_url AS "instagramUrl", weibo_url AS "weiboUrl", profile_public AS "profilePublic" FROM user_profiles WHERE user_id = ${userId} LIMIT 1`; return rows[0] as UserProfileRecord | undefined; }
  async searchPublicUsers(query: string, limit = 20) {
    const needle = `%${query.trim().replace(/[%_]/g, '\\$&')}%`;
    const rows = await this.db`SELECT u.username, p.display_name AS "displayName", p.bio, p.location, p.avatar_media_id AS "avatarMediaId"
      FROM users u JOIN user_profiles p ON p.user_id = u.id
      WHERE (p.profile_public = true OR EXISTS (
          SELECT 1
          FROM workspaces w
          JOIN photos photo ON photo.workspace_id = w.id
          WHERE w.owner_user_id = u.id
            AND w.kind = 'personal'
            AND photo.published = true
            AND photo.hidden = false
            AND COALESCE(photo.metadata->>'ownerOnly', 'false') <> 'true'
        ))
        AND u.disabled = false AND u.deleted_at IS NULL
        AND (lower(u.username) LIKE lower(${needle}) ESCAPE '\\' OR lower(COALESCE(p.display_name, '')) LIKE lower(${needle}) ESCAPE '\\')
      ORDER BY lower(COALESCE(p.display_name, u.username)), lower(u.username) LIMIT ${Math.min(50, Math.max(1, limit))}`;
    return rows as unknown as PublicProfileSearchRecord[];
  }
  async listPublicPhotosForUser(userId: string) {
    const spaces = await this.db`SELECT id FROM workspaces WHERE owner_user_id = ${userId} AND kind = 'personal'`;
    const photos: PhotoRecord[] = [];
    for (const space of spaces) photos.push(...(await this.listPhotos(String(space.id))).filter(isPhotoPublic));
    return photos;
  }
  async saveUserProfile(profile: UserProfileRecord) { await this.db`INSERT INTO user_profiles (user_id, avatar_media_id, display_name, bio, location, website_url, instagram_url, weibo_url, profile_public) VALUES (${profile.userId}, ${profile.avatarMediaId}, ${profile.displayName}, ${profile.bio}, ${profile.location}, ${profile.websiteUrl}, ${profile.instagramUrl}, ${profile.weiboUrl}, ${profile.profilePublic}) ON CONFLICT (user_id) DO UPDATE SET avatar_media_id = EXCLUDED.avatar_media_id, display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, location = EXCLUDED.location, website_url = EXCLUDED.website_url, instagram_url = EXCLUDED.instagram_url, weibo_url = EXCLUDED.weibo_url, profile_public = EXCLUDED.profile_public, updated_at = now()`; }
  async saveEmailChallenge(challenge: EmailChallengeRecord) { await this.db`INSERT INTO email_challenges (id, user_id, purpose, token_hash, code_hash, expires_at, attempts, consumed_at) VALUES (${challenge.id}, ${challenge.userId}, ${challenge.purpose}, ${challenge.tokenHash}, ${challenge.codeHash}, ${challenge.expiresAt}, ${challenge.attempts}, ${challenge.consumedAt}) ON CONFLICT (id) DO UPDATE SET attempts = EXCLUDED.attempts, consumed_at = EXCLUDED.consumed_at`; }
  async findEmailChallengeByTokenHash(tokenHash: string, purpose: EmailChallengeRecord['purpose']) { const rows = await this.db`SELECT id, user_id AS "userId", purpose, token_hash AS "tokenHash", code_hash AS "codeHash", expires_at AS "expiresAt", attempts, consumed_at AS "consumedAt" FROM email_challenges WHERE token_hash = ${tokenHash} AND purpose = ${purpose} AND consumed_at IS NULL LIMIT 1`; return rows[0] as EmailChallengeRecord | undefined; }
  async findLatestEmailChallenge(userId: string, purpose: EmailChallengeRecord['purpose']) { const rows = await this.db`SELECT id, user_id AS "userId", purpose, token_hash AS "tokenHash", code_hash AS "codeHash", expires_at AS "expiresAt", attempts, consumed_at AS "consumedAt" FROM email_challenges WHERE user_id = ${userId} AND purpose = ${purpose} AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`; return rows[0] as EmailChallengeRecord | undefined; }
  async updateEmailChallenge(id: string, patch: Partial<Pick<EmailChallengeRecord, 'attempts' | 'consumedAt'>>) { await this.db`UPDATE email_challenges SET attempts = CASE WHEN ${patch.attempts !== undefined} THEN ${patch.attempts ?? 0} ELSE attempts END, consumed_at = CASE WHEN ${patch.consumedAt !== undefined} THEN ${patch.consumedAt ?? null} ELSE consumed_at END WHERE id = ${id}`; }
  async saveRefreshToken(hash: string, userId: string, expiresAt: Date) { await this.db`INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (${hash}, ${userId}, ${expiresAt}) ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`; }
  async consumeRefreshToken(hash: string) { const rows = await this.db`DELETE FROM refresh_tokens WHERE token_hash = ${hash} AND expires_at > now() RETURNING user_id`; return rows[0]?.user_id as string | undefined; }
  async revokeRefreshToken(hash: string) { await this.db`DELETE FROM refresh_tokens WHERE token_hash = ${hash}`; }
  async revokeAllRefreshTokens(userId: string) { await this.db`DELETE FROM refresh_tokens WHERE user_id = ${userId}`; }
  async listWorkspaces() { return await this.db`SELECT id, slug, name, kind, owner_user_id AS "ownerUserId", is_public AS "isPublic", allow_member_showcase AS "allowMemberShowcase" FROM workspaces ORDER BY slug` as unknown as WorkspaceRecord[]; }
  async listWorkspacesForUser(userId: string) {
    return await this.db`SELECT w.id, w.slug, w.name, w.kind, w.owner_user_id AS "ownerUserId", w.is_public AS "isPublic", w.allow_member_showcase AS "allowMemberShowcase", m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ${userId} ORDER BY w.slug` as unknown as AccessibleWorkspaceRecord[];
  }
  async saveWorkspace(workspace: WorkspaceRecord) {
    const rows = await this.db`INSERT INTO workspaces (id, slug, name, kind, owner_user_id, is_public, allow_member_showcase) VALUES (${workspace.id}, ${workspace.slug}, ${workspace.name}, ${workspace.kind ?? 'collaborative'}, ${workspace.ownerUserId ?? null}, ${workspace.isPublic ?? false}, ${workspace.allowMemberShowcase ?? false}) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, slug, name, kind, owner_user_id AS "ownerUserId", is_public AS "isPublic", allow_member_showcase AS "allowMemberShowcase"`;
    return rows[0] as WorkspaceRecord;
  }
  async findWorkspaceBySlug(slug: string) { const rows = await this.db`SELECT id, slug, name, kind, owner_user_id AS "ownerUserId", is_public AS "isPublic", allow_member_showcase AS "allowMemberShowcase" FROM workspaces WHERE slug = ${slug} LIMIT 1`; return rows[0] as WorkspaceRecord | undefined; }
  async findMembership(workspaceId: string, userId: string) { const rows = await this.db`SELECT workspace_id AS "workspaceId", user_id AS "userId", role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId} LIMIT 1`; return rows[0] as MembershipRecord | undefined; }
  async listMemberships(workspaceId: string) { return await this.db`SELECT workspace_id AS "workspaceId", user_id AS "userId", role FROM memberships WHERE workspace_id = ${workspaceId} ORDER BY created_at, user_id` as unknown as MembershipRecord[]; }
  async listWorkspaceMembers(workspaceId: string) { return await this.db`SELECT m.user_id AS "userId", u.email, u.name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${workspaceId} ORDER BY m.created_at, u.email` as unknown as WorkspaceMemberRecord[]; }
  async saveMembership(value: MembershipRecord) { await this.db`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${value.workspaceId}, ${value.userId}, ${value.role}) ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`; }
  async updateMembershipRole(workspaceId: string, userId: string, role: MembershipRecord['role']) { const result = await this.db`UPDATE memberships SET role = ${role} WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`; return result.count > 0; }
  async listPhotos(workspaceId: string) {
    const rows = await this.db`SELECT p.id, p.workspace_id AS "workspaceId", p.checksum, p.metadata, w.slug AS "spaceSlug", p.title, p.description, p.published, p.hidden, p.rating, p.captured_at AS "capturedAt", p.created_at AS "createdAt", p.latitude, p.longitude, p.location_id AS "locationId", l.display_name AS "locationName" FROM photos p JOIN workspaces w ON w.id = p.workspace_id LEFT JOIN locations l ON l.id = p.location_id WHERE p.workspace_id = ${workspaceId} ORDER BY p.sort_order, p.id`;
    if (!rows.length) return [];
    const files = await this.db`SELECT photo_id AS "photoId", kind, storage_key AS "storageKey", width, height, format FROM photo_files WHERE photo_id = ANY(${this.db.array(rows.map((row) => String(row.id)))})`;
    const filesByPhoto = new Map<string, Array<Record<string, unknown>>>();
    for (const file of files) {
      const list = filesByPhoto.get(String(file.photoId)) ?? [];
      list.push(file as Record<string, unknown>);
      filesByPhoto.set(String(file.photoId), list);
    }
    return rows.map((row) => toPhotoRecord(row as Record<string, unknown>, filesByPhoto.get(String(row.id)) ?? []));
  }
  async findPhoto(workspaceId: string, id: string) {
    const rows = await this.db`SELECT p.id, p.workspace_id AS "workspaceId", p.checksum, p.metadata, w.slug AS "spaceSlug", p.title, p.description, p.published, p.hidden, p.rating, p.captured_at AS "capturedAt", p.created_at AS "createdAt", p.latitude, p.longitude, p.location_id AS "locationId", l.display_name AS "locationName" FROM photos p JOIN workspaces w ON w.id = p.workspace_id LEFT JOIN locations l ON l.id = p.location_id WHERE p.workspace_id = ${workspaceId} AND p.id = ${id} LIMIT 1`;
    if (!rows[0]) return undefined;
    const files = await this.db`SELECT photo_id AS "photoId", kind, storage_key AS "storageKey", width, height, format FROM photo_files WHERE photo_id = ${id}`;
    return toPhotoRecord(rows[0] as Record<string, unknown>, files as unknown as Array<Record<string, unknown>>);
  }
  async savePhoto(photo: PhotoRecord) {
    const metadata = objectValue(photo.metadata);
    if (photo.ownerOnly === true) metadata.ownerOnly = true;
    else if (photo.ownerOnly === false) delete metadata.ownerOnly;
    const latitude = numberOrUndefined(photo.latitude ?? metadata.latitude);
    const longitude = numberOrUndefined(photo.longitude ?? metadata.longitude);
    await this.db`INSERT INTO photos (id, workspace_id, title, description, metadata, latitude, longitude, published, hidden, rating, checksum)
      VALUES (${photo.id}, ${photo.workspaceId}, ${photo.title}, ${photo.description}, ${this.db.json(JSON.parse(JSON.stringify(metadata)))}, ${latitude ?? null}, ${longitude ?? null}, ${photo.published}, ${photo.hidden}, ${photo.rating}, ${photo.checksum ?? photo.id})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, metadata = EXCLUDED.metadata,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, published = EXCLUDED.published, hidden = EXCLUDED.hidden, rating = EXCLUDED.rating`;
  }
  async updatePhoto(id: string, workspaceId: string, patch: Partial<PhotoRecord>) { const photo = await this.findPhoto(workspaceId, id); if (!photo) return undefined; const updated = { ...photo, ...patch }; await this.savePhoto(updated); return updated; }
  async listAlbums(workspaceId: string, publishedOnly = false) {
    const rows = await this.db`SELECT a.id, a.workspace_id AS "workspaceId", w.slug AS "spaceSlug", a.title, a.description, a.shoot_date AS "shootDate", a.cover_photo_id AS "coverPhotoId", a.sort_order AS "sortOrder"
      FROM albums a JOIN workspaces w ON w.id = a.workspace_id
      WHERE a.workspace_id = ${workspaceId} ORDER BY a.sort_order, a.title`;
    const ids = rows.map((row) => String(row.id));
    const links = ids.length ? await this.db`SELECT album_id AS "albumId", photo_id AS "photoId" FROM album_photos WHERE album_id = ANY(${this.db.array(ids)}::uuid[]) ORDER BY sort_order, photo_id` : [];
    const photos = publishedOnly ? await this.db`SELECT id FROM photos WHERE workspace_id = ${workspaceId} AND published = true AND hidden = false AND COALESCE(metadata->>'ownerOnly', 'false') <> 'true'` : [];
    const publicIds = new Set(photos.map((row) => String(row.id)));
    const linksByAlbum = new Map<string, string[]>();
    for (const link of links) {
      if (publishedOnly && !publicIds.has(String(link.photoId))) continue;
      const list = linksByAlbum.get(String(link.albumId)) ?? [];
      list.push(String(link.photoId));
      linksByAlbum.set(String(link.albumId), list);
    }
    return rows.map((row) => ({ ...row, id: String(row.id), workspaceId: String(row.workspaceId), spaceSlug: String(row.spaceSlug), title: String(row.title), description: row.description == null ? undefined : String(row.description), shootDate: dateOnlyString(row.shootDate), coverPhotoId: row.coverPhotoId == null ? null : String(row.coverPhotoId), sortOrder: Number(row.sortOrder), photoIds: linksByAlbum.get(String(row.id)) ?? [] }))
      .filter((album) => !publishedOnly || album.photoIds.length > 0) as AlbumRecord[];
  }
  async findAlbum(workspaceId: string, albumId: string, publishedOnly = false) { const albums = await this.listAlbums(workspaceId, publishedOnly); return albums.find((album) => album.id === albumId); }
  async saveAlbum(album: AlbumRecord) {
    await this.db`INSERT INTO albums (id, workspace_id, title, description, shoot_date, cover_photo_id, sort_order) VALUES (${album.id}, ${album.workspaceId}, ${album.title}, ${album.description ?? null}, ${album.shootDate ?? null}, ${album.coverPhotoId}, ${album.sortOrder}) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, shoot_date = EXCLUDED.shoot_date, cover_photo_id = EXCLUDED.cover_photo_id, sort_order = EXCLUDED.sort_order`;
    await this.setAlbumPhotos(album.id, album.workspaceId, album.photoIds);
    return album;
  }
  async updateAlbum(id: string, workspaceId: string, patch: Partial<Pick<AlbumRecord, 'title' | 'description' | 'shootDate' | 'coverPhotoId' | 'sortOrder'>>) { const album = await this.findAlbum(workspaceId, id); if (!album) return undefined; const updated = { ...album, ...patch }; await this.saveAlbum(updated); return updated; }
  async deleteAlbum(id: string, workspaceId: string) { const album = await this.findAlbum(workspaceId, id); if (!album) return false; const result = await this.db`DELETE FROM albums WHERE id = ${album.id} AND workspace_id = ${workspaceId}`; return result.count > 0; }
  async setAlbumPhotos(id: string, workspaceId: string, photoIds: string[]) { const album = await this.findAlbum(workspaceId, id); if (!album) return undefined; const validPhotos = await this.db`SELECT id FROM photos WHERE workspace_id = ${workspaceId} AND id = ANY(${this.db.array([...new Set(photoIds)])})`; const validIds = validPhotos.map((row) => String(row.id)); await this.db`DELETE FROM album_photos WHERE album_id = ${album.id}`; for (const [index, photoId] of validIds.entries()) await this.db`INSERT INTO album_photos (album_id, photo_id, sort_order) VALUES (${album.id}, ${photoId}, ${index}) ON CONFLICT (album_id, photo_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`; return { ...album, photoIds: validIds }; }
  async getWorkspaceSummary(workspaceId: string): Promise<WorkspaceSummaryRecord> {
    const rows = await this.db`SELECT count(*)::int AS "photoCount", count(*) FILTER (WHERE published = true AND hidden = false)::int AS "publishedPhotoCount" FROM photos WHERE workspace_id = ${workspaceId}`;
    const pending = await this.db`SELECT count(*)::int AS count FROM import_batches WHERE workspace_id = ${workspaceId} AND status IN ('uploaded', 'preview', 'queued', 'processing')`;
    const activity = await this.db`SELECT id, status, total_count AS total, completed_count AS completed, failed_count AS failed, created_at AS "createdAt" FROM import_batches WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT 5`;
    return {
      photoCount: Number(rows[0]?.photoCount ?? 0),
      publishedPhotoCount: Number(rows[0]?.publishedPhotoCount ?? 0),
      pendingImportCount: Number(pending[0]?.count ?? 0),
      recentActivity: activity.map((row) => ({ type: 'import' as const, id: String(row.id), status: String(row.status), total: Number(row.total), completed: Number(row.completed), failed: Number(row.failed), createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString() })),
    };
  }
  async listImportBatches(workspaceId: string): Promise<ImportBatchSummaryRecord[]> {
    const rows = await this.db`SELECT batch.id, batch.workspace_id AS "workspaceId", batch.status, batch.total_count AS total, batch.completed_count AS completed, batch.failed_count AS failed, batch.created_at AS "createdAt",
      (SELECT COUNT(*)::int FROM photos p JOIN import_items item ON item.batch_id = batch.id AND item.status = 'completed' AND item.checksum = p.checksum
        WHERE p.workspace_id = batch.workspace_id AND p.published = true) AS "publishedCount"
      FROM import_batches batch WHERE batch.workspace_id = ${workspaceId} ORDER BY batch.created_at DESC LIMIT 100`;
    return rows.map((row) => ({ id: String(row.id), workspaceId: String(row.workspaceId), status: String(row.status), counts: { total: Number(row.total), completed: Number(row.completed), failed: Number(row.failed) }, publishedCount: Number(row.publishedCount ?? 0), createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString() }));
  }
  async publishBatchPhotos(batchId: string, workspaceId: string): Promise<number> {
    const rows = await this.db`
      UPDATE photos
      SET published = true, hidden = false, updated_at = now()
      WHERE workspace_id = ${workspaceId}
        AND checksum IN (
          SELECT checksum FROM import_items
          WHERE batch_id = ${batchId} AND status = 'completed' AND checksum IS NOT NULL
        )
      RETURNING id
    `;
    return rows.length;
  }
  async createBatch(batch: BatchRecord) { await this.saveBatch(batch); return batch; }
  async findBatchByIdempotency(workspaceId: string, key: string) { const rows = await this.db`SELECT id FROM import_batches WHERE workspace_id = ${workspaceId} AND idempotency_key = ${key} LIMIT 1`; return rows[0] ? this.findBatch(String(rows[0].id), workspaceId) : undefined; }
  async findBatch(id: string, workspaceId: string) {
    const rows = await this.db`SELECT batch.id, batch.workspace_id AS "workspaceId", batch.actor_id AS "actorId", batch.status, batch.idempotency_key AS "idempotencyKey", batch.created_at AS "createdAt",
      (SELECT COUNT(*)::int FROM photos p JOIN import_items item ON item.batch_id = batch.id AND item.status = 'completed' AND item.checksum = p.checksum
        WHERE p.workspace_id = batch.workspace_id AND p.published = true) AS "publishedCount"
      FROM import_batches batch WHERE batch.id = ${id} AND batch.workspace_id = ${workspaceId}`;
    if (!rows[0]) return undefined;
    const items = await this.db`SELECT id, source_key AS "sourceKey", status, checksum, errors, warnings, resolved_fields AS "resolvedFields" FROM import_items WHERE batch_id = ${id}`;
    return { ...rows[0], publishedCount: Number(rows[0].publishedCount ?? 0), items, counts: { total: items.length, completed: items.filter((item) => item.status === 'completed').length, failed: items.filter((item) => item.status === 'failed').length } } as unknown as BatchRecord;
  }
  async saveBatch(batch: BatchRecord) { await this.db`INSERT INTO import_batches (id, workspace_id, actor_id, status, idempotency_key, total_count, completed_count, failed_count) VALUES (${batch.id}, ${batch.workspaceId}, ${batch.actorId}, ${batch.status}, ${batch.idempotencyKey ?? null}, ${batch.counts.total}, ${batch.counts.completed}, ${batch.counts.failed}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total_count = EXCLUDED.total_count, completed_count = EXCLUDED.completed_count, failed_count = EXCLUDED.failed_count`; for (const item of batch.items) await this.db`INSERT INTO import_items (id, batch_id, source_key, status, checksum, errors, warnings, resolved_fields) VALUES (${item.id}, ${batch.id}, ${item.sourceKey}, ${item.status}, ${item.checksum ?? null}, ${this.db.json(JSON.parse(JSON.stringify(item.errors)))}, ${this.db.json(JSON.parse(JSON.stringify(item.warnings)))}, ${this.db.json(JSON.parse(JSON.stringify(item.resolvedFields)))}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, checksum = EXCLUDED.checksum, errors = EXCLUDED.errors, warnings = EXCLUDED.warnings, resolved_fields = EXCLUDED.resolved_fields`; }
  async createMediaUpload(upload: MediaUploadRecord) {
    const rows = await this.db`INSERT INTO media_uploads (id, workspace_id, created_by, storage_key, storage_upload_id, filename, content_type, byte_size, checksum, part_size, part_count, status, expires_at, completed_at)
      VALUES (${upload.id}, ${upload.workspaceId}, ${upload.createdBy}, ${upload.storageKey}, ${upload.storageUploadId}, ${upload.filename}, ${upload.contentType}, ${upload.byteSize}, ${upload.checksum ?? null}, ${upload.partSize}, ${upload.partCount}, ${upload.status}, ${upload.expiresAt}, ${upload.completedAt ?? null})
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, completed_at = EXCLUDED.completed_at, updated_at = now()
      RETURNING id, workspace_id AS "workspaceId", created_by AS "createdBy", storage_key AS "storageKey", storage_upload_id AS "storageUploadId", filename, content_type AS "contentType", byte_size AS "byteSize", checksum, part_size AS "partSize", part_count AS "partCount", status, expires_at AS "expiresAt", completed_at AS "completedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;
    return normalizeMediaUpload(rows[0]);
  }
  async findMediaUpload(id: string, workspaceId: string) {
    const rows = await this.db`SELECT id, workspace_id AS "workspaceId", created_by AS "createdBy", storage_key AS "storageKey", storage_upload_id AS "storageUploadId", filename, content_type AS "contentType", byte_size AS "byteSize", checksum, part_size AS "partSize", part_count AS "partCount", status, expires_at AS "expiresAt", completed_at AS "completedAt", created_at AS "createdAt", updated_at AS "updatedAt" FROM media_uploads WHERE id = ${id} AND workspace_id = ${workspaceId} LIMIT 1`;
    return rows[0] ? normalizeMediaUpload(rows[0]) : undefined;
  }
  async updateMediaUpload(id: string, workspaceId: string, patch: Partial<Pick<MediaUploadRecord, 'status' | 'completedAt'>>) {
    const rows = await this.db`UPDATE media_uploads SET status = CASE WHEN ${patch.status !== undefined} THEN ${patch.status ?? null} ELSE status END, completed_at = CASE WHEN ${patch.completedAt !== undefined} THEN ${patch.completedAt ?? null} ELSE completed_at END, updated_at = now() WHERE id = ${id} AND workspace_id = ${workspaceId} RETURNING id, workspace_id AS "workspaceId", created_by AS "createdBy", storage_key AS "storageKey", storage_upload_id AS "storageUploadId", filename, content_type AS "contentType", byte_size AS "byteSize", checksum, part_size AS "partSize", part_count AS "partCount", status, expires_at AS "expiresAt", completed_at AS "completedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;
    return rows[0] ? normalizeMediaUpload(rows[0]) : undefined;
  }
  async listExpiredMediaUploads(now = new Date()) {
    const rows = await this.db`SELECT id, workspace_id AS "workspaceId", created_by AS "createdBy", storage_key AS "storageKey", storage_upload_id AS "storageUploadId", filename, content_type AS "contentType", byte_size AS "byteSize", checksum, part_size AS "partSize", part_count AS "partCount", status, expires_at AS "expiresAt", completed_at AS "completedAt", created_at AS "createdAt", updated_at AS "updatedAt" FROM media_uploads WHERE status = 'initiated' AND expires_at <= ${now} ORDER BY expires_at LIMIT 100`;
    return rows.map(normalizeMediaUpload);
  }
}

export function createRepository(databaseUrl = process.env.DATABASE_URL): { repository: AppRepository; close: () => Promise<void> } {
  const useDatabase = process.env.N25_USE_DATABASE;
  if (useDatabase !== '1' || !databaseUrl) return { repository: new MemoryRepository(), close: async () => undefined };
  const db = postgres(databaseUrl, { max: 4 });
  return { repository: new PostgresRepository(db), close: () => db.end() };
}

function toPhotoRecord(row: Record<string, unknown>, files: Array<Record<string, unknown>>): PhotoRecord {
  const variants = files.map((file) => ({
    kind: String(file.kind) as 'original' | 'thumbnail' | 'preview' | 'large',
    url: publicUrl(String(file.storageKey)),
    width: Number(file.width),
    height: Number(file.height),
    format: String(file.format),
  })).filter((file) => file.width > 0 && file.height > 0);
  const publicVariants = variants.filter((file) => file.kind !== 'original');
  const thumbnail = publicVariants.find((file) => file.kind === 'thumbnail') ?? publicVariants.find((file) => file.kind === 'preview') ?? publicVariants.find((file) => file.kind === 'large') ?? {
    kind: 'thumbnail' as const,
    url: publicUrl(`photos/${String(row.id)}/thumbnail.jpg`),
    width: 1,
    height: 1,
    format: 'jpeg',
  };
  const capturedAt = toIsoString(row.capturedAt ?? row.createdAt) ?? new Date(0).toISOString();
  const latitude = numberOrUndefined(row.latitude);
  const longitude = numberOrUndefined(row.longitude);
  const metadata = objectValue(row.metadata);
  const locationName = stringValue(row.locationName) ?? stringValue(metadata.locationName);
  const locationId = stringValue(row.locationId) ?? (locationName ? `photo-${String(row.id)}-location` : undefined);
  return {
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    spaceSlug: String(row.spaceSlug),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    published: Boolean(row.published),
    hidden: Boolean(row.hidden),
    ownerOnly: metadata.ownerOnly === true,
    rating: row.rating == null ? null : Number(row.rating),
    checksum: row.checksum == null ? undefined : String(row.checksum),
    capturedAt,
    aspectRatio: thumbnail.width / thumbnail.height,
    thumbnail,
    media: publicVariants.filter((file) => file !== thumbnail),
    location: locationId && locationName ? { id: locationId, name: locationName } : null,
    latitude,
    longitude,
    metadata: { ...metadata, ...(latitude == null && longitude == null ? {} : { latitude, longitude }) },
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result || undefined;
}

function publicUrl(key: string): string {
  const base = (process.env.S3_PUBLIC_BASE_URL ?? 'https://cdn.invalid').replace(/\/$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function normalizeMediaUpload(row: Record<string, unknown> | undefined): MediaUploadRecord {
  if (!row) throw new Error('Media upload record was not returned');
  return {
    id: String(row.id), workspaceId: String(row.workspaceId), createdBy: String(row.createdBy), storageKey: String(row.storageKey), storageUploadId: String(row.storageUploadId),
    filename: String(row.filename), contentType: String(row.contentType), byteSize: Number(row.byteSize), checksum: row.checksum == null ? null : String(row.checksum),
    partSize: Number(row.partSize), partCount: Number(row.partCount), status: String(row.status) as MediaUploadStatus,
    expiresAt: new Date(String(row.expiresAt)), completedAt: row.completedAt == null ? null : new Date(String(row.completedAt)),
    createdAt: row.createdAt == null ? undefined : new Date(String(row.createdAt)), updatedAt: row.updatedAt == null ? undefined : new Date(String(row.updatedAt)),
  };
}

function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

export function dateOnlyString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T ])/);
  return match?.[1] ?? null;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value == null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
