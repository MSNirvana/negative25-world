import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ApiError } from '@negative25/utils';
import { DEFAULT_USER_ID, type AppRepository, type EmailChallengeRecord, type UserProfileRecord, type UserRecord } from '../../db/repository.js';

export interface PasswordHasher { hash(value: string): Promise<string>; verify(hash: string, value: string): Promise<boolean>; }
export class Argon2idPasswordHasher implements PasswordHasher { hash(value: string) { return argon2.hash(value, { type: argon2.argon2id }); } verify(hash: string, value: string) { return argon2.verify(hash, value); } }

const RESERVED_USERNAMES = new Set(['admin', 'discover', 'albums', 'about', 'api', 'photo', 'auth', 'account', 'platform', 'settings', 'login', 'register']);

export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,24}$/.test(username) || RESERVED_USERNAMES.has(username)) throw new ApiError('VALIDATION_ERROR', 'Username is invalid or reserved');
  return username;
}

export type RegisterInput = { username: string; email: string; password: string };

export class AuthService {
  private readonly secret: Uint8Array;
  private readonly refreshSecret: Uint8Array;
  constructor(private readonly repository: AppRepository, private readonly hasher: PasswordHasher = new Argon2idPasswordHasher(), secret = process.env.JWT_SECRET ?? 'negative25-development-secret', refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'negative25-development-refresh-secret') { this.secret = new TextEncoder().encode(secret); this.refreshSecret = new TextEncoder().encode(refreshSecret); }
  get defaultUserId() { return DEFAULT_USER_ID; }

  async seed(email = 'owner@n25.world', password = 'negative25'): Promise<UserRecord> {
    let existing = await this.repository.findUserByEmail(email);
    if (existing) {
      if (!existing.username) existing = await this.repository.updateUser(existing.id, { username: 'negative25' }) ?? existing;
      if (!(await this.repository.findUserProfile(existing.id))) await this.repository.saveUserProfile(defaultProfile(existing.id, existing.name));
      return existing;
    }
    const user: UserRecord = { id: this.defaultUserId, username: 'negative25', email: email.toLowerCase(), name: 'negative25 Owner', passwordHash: await this.hasher.hash(password), emailVerifiedAt: new Date() };
    await this.repository.saveUser(user);
    await this.repository.saveUserProfile(defaultProfile(user.id, user.name));
    return user;
  }

  async register(input: RegisterInput): Promise<{ session: Awaited<ReturnType<AuthService['issue']>>; user: UserRecord; verificationToken: string; verificationCode: string }> {
    const username = normalizeUsername(input.username);
    const email = input.email.trim().toLowerCase();
    if (await this.repository.findUserByUsername(username)) throw new ApiError('CONFLICT', 'Username is already in use');
    if (await this.repository.findUserByEmail(email)) throw new ApiError('CONFLICT', 'Email is already in use');
    const user: UserRecord = { id: randomUUID(), username, email, name: input.username.trim(), passwordHash: await this.hasher.hash(input.password), emailVerifiedAt: null };
    await this.repository.saveUser(user);
    await this.repository.saveUserProfile(defaultProfile(user.id, input.username.trim()));
    const slug = `u-${user.id}`;
    await this.repository.saveWorkspace({ id: randomUUID(), slug, name: `${input.username.trim()}'s photography`, kind: 'personal', ownerUserId: user.id, isPublic: false, allowMemberShowcase: true });
    const workspace = await this.repository.findWorkspaceBySlug(slug);
    if (workspace) await this.repository.saveMembership({ workspaceId: workspace.id, userId: user.id, role: 'owner' });
    const challenge = await this.createChallenge(user, 'verify_email');
    return { session: await this.issue(user), user, verificationToken: challenge.token, verificationCode: challenge.code };
  }

  async login(identifier: string, password: string) {
    const value = identifier.trim().toLowerCase();
    const user = value.includes('@') ? await this.repository.findUserByEmail(value) : await this.repository.findUserByUsername(value);
    if (!user || user.disabled || user.deletedAt || !(await this.hasher.verify(user.passwordHash, password))) throw new ApiError('UNAUTHORIZED', 'Invalid username or password');
    return this.issue(user);
  }

  async getProfile(user: UserRecord) {
    const profile = await this.repository.findUserProfile(user.id) ?? defaultProfile(user.id, user.name);
    return profileResponse(user, profile);
  }

  async updateProfile(user: UserRecord, patch: Partial<UserProfileRecord>) {
    const current = await this.repository.findUserProfile(user.id) ?? defaultProfile(user.id, user.name);
    const next = { ...current, ...patch, userId: user.id };
    await this.repository.saveUserProfile(next);
    if (patch.displayName !== undefined) await this.repository.updateUser(user.id, { name: patch.displayName });
    return profileResponse((await this.repository.findUserById(user.id)) ?? user, next);
  }

  async getPublicProfile(username: string) {
    const user = await this.repository.findUserByUsername(normalizeUsername(username));
    if (!user || user.disabled || user.deletedAt) throw new ApiError('NOT_FOUND', 'Profile not found');
    const profile = await this.repository.findUserProfile(user.id) ?? defaultProfile(user.id, user.name);
    const photos = await this.repository.listPublicPhotosForUser(user.id);
    // Published photos are discoverable through user search even when the
    // optional profile toggle is off. Keep private drafts and hidden photos out.
    if (!profile.profilePublic) throw new ApiError('NOT_FOUND', 'Profile not found');
    const response = profileResponse(user, profile);
    const workspace = (await this.repository.listWorkspaces()).find((item) => item.ownerUserId === user.id && item.kind === 'personal');
    return { username: response.username, displayName: response.displayName, bio: response.bio, location: response.location, websiteUrl: response.websiteUrl, instagramUrl: response.instagramUrl, weiboUrl: response.weiboUrl, avatarMediaId: response.avatarMediaId, profilePublic: response.profilePublic, workspaceSlug: workspace?.slug ?? null, photos: photos.slice(0, 100) };
  }

  async searchPublicUsers(query: string) {
    const value = query.trim();
    if (!value) return [];
    return this.repository.searchPublicUsers(value, 20);
  }

  async authenticate(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.secret);
      const user = await this.repository.findUserById(String(payload.sub));
      if (!user || user.disabled || user.deletedAt) throw new Error();
      return user;
    } catch { throw new ApiError('UNAUTHORIZED', 'Authentication required'); }
  }

  async refresh(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret);
      const userId = await this.repository.consumeRefreshToken(hashValue(token));
      if (!userId || userId !== payload.sub) throw new Error();
      const user = await this.repository.findUserById(userId);
      if (!user) throw new Error();
      return this.issue(user);
    } catch { throw new ApiError('UNAUTHORIZED', 'Invalid refresh token'); }
  }

  async verifyEmail(input: { email?: string; token?: string; code?: string }): Promise<UserRecord> {
    let challenge: EmailChallengeRecord | undefined;
    if (input.token) challenge = await this.repository.findEmailChallengeByTokenHash(hashValue(input.token), 'verify_email');
    else if (input.email && input.code) {
      const user = await this.repository.findUserByEmail(input.email);
      if (user) challenge = await this.repository.findLatestEmailChallenge(user.id, 'verify_email');
    }
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) throw new ApiError('UNAUTHORIZED', 'Verification code is invalid or expired');
    if (input.code && challenge.codeHash !== hashValue(input.code)) {
      await this.repository.updateEmailChallenge(challenge.id, { attempts: challenge.attempts + 1 });
      throw new ApiError('UNAUTHORIZED', 'Verification code is invalid or expired');
    }
    await this.repository.updateEmailChallenge(challenge.id, { consumedAt: new Date() });
    const user = await this.repository.updateUser(challenge.userId, { emailVerifiedAt: new Date() });
    if (!user) throw new ApiError('NOT_FOUND', 'User not found');
    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (user && !user.disabled && !user.deletedAt) await this.createChallenge(user, 'reset_password');
  }

  async resendVerification(email: string): Promise<{ verificationToken: string; verificationCode: string } | null> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || user.emailVerifiedAt || user.disabled || user.deletedAt) return null;
    const challenge = await this.createChallenge(user, 'verify_email');
    return { verificationToken: challenge.token, verificationCode: challenge.code };
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const challenge = await this.repository.findEmailChallengeByTokenHash(hashValue(token), 'reset_password');
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) throw new ApiError('UNAUTHORIZED', 'Reset token is invalid or expired');
    const user = await this.repository.findUserById(challenge.userId);
    if (!user) throw new ApiError('UNAUTHORIZED', 'Reset token is invalid or expired');
    await this.repository.updateUser(user.id, { passwordHash: await this.hasher.hash(password) });
    await this.repository.updateEmailChallenge(challenge.id, { consumedAt: new Date() });
    await this.repository.revokeAllRefreshTokens(user.id);
  }

  async changePassword(user: UserRecord, currentPassword: string, password: string): Promise<void> {
    if (!(await this.hasher.verify(user.passwordHash, currentPassword))) throw new ApiError('UNAUTHORIZED', 'Current password is incorrect');
    await this.repository.updateUser(user.id, { passwordHash: await this.hasher.hash(password) });
    await this.repository.revokeAllRefreshTokens(user.id);
  }

  async logout(refreshToken: string): Promise<void> { await this.repository.revokeRefreshToken(hashValue(refreshToken)); }
  async logoutAll(userId: string): Promise<void> { await this.repository.revokeAllRefreshTokens(userId); }

  private async createChallenge(user: UserRecord, purpose: EmailChallengeRecord['purpose']): Promise<{ token: string; code: string }> {
    const token = randomBytes(32).toString('hex');
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    await this.repository.saveEmailChallenge({ id: randomUUID(), userId: user.id, purpose, tokenHash: hashValue(token), codeHash: hashValue(code), expiresAt: new Date(Date.now() + (purpose === 'reset_password' ? 30 : 24 * 60) * 60 * 1000), attempts: 0, consumedAt: null });
    return { token, code };
  }

  private async issue(user: UserRecord) {
    const accessToken = await new SignJWT({ email: user.email, username: user.username, emailVerified: Boolean(user.emailVerifiedAt) }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('15m').sign(this.secret);
    const refreshToken = await new SignJWT().setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('30d').sign(this.refreshSecret);
    await this.repository.saveRefreshToken(hashValue(refreshToken), user.id, new Date(Date.now() + 30 * 86400000));
    return { accessToken, refreshToken, expiresIn: 900 };
  }
}

function hashValue(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function defaultProfile(userId: string, displayName: string | null = null): UserProfileRecord { return { userId, avatarMediaId: null, displayName, bio: null, location: null, websiteUrl: null, instagramUrl: null, weiboUrl: null, profilePublic: true }; }
export function publicUser(user: UserRecord): { id: string; username?: string; email: string; name: string | null; emailVerifiedAt: string | null } { return { id: user.id, ...(user.username ? { username: user.username } : {}), email: user.email, name: user.name, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null }; }
function profileResponse(user: UserRecord, profile: UserProfileRecord) { return { userId: user.id, username: user.username ?? '', email: user.email, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null, displayName: profile.displayName, bio: profile.bio, location: profile.location, websiteUrl: profile.websiteUrl, instagramUrl: profile.instagramUrl, weiboUrl: profile.weiboUrl, avatarMediaId: profile.avatarMediaId, profilePublic: profile.profilePublic }; }
