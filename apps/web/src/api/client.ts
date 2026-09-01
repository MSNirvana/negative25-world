import { AdminAlbumSchema, AdminSummarySchema, AlbumDetailSchema, AlbumSummarySchema, DiscoverLocationsResponseSchema, ImportBatchSummarySchema, ImportPreviewSchema, ImportPublishResponseSchema, PhotoListResponseSchema, PhotoSummarySchema, PublicProfileSchema, PublicProfileSearchResponseSchema, SessionSchema, UserProfilePatchSchema, UserProfileSchema, UserSchema, WorkspaceMemberSchema, WorkspaceSchema, type AdminAlbum, type AdminSummary, type AlbumDetail, type AlbumSummary, type DiscoverLocationRecord, type ImportBatchSummary, type ImportPreview, type ImportPublishResponse, type PhotoSummary, type PublicProfile, type PublicProfileSearchResult, type UserProfile, type Workspace, type WorkspaceMember } from '@negative25/contracts';
export type { PublicProfile } from '@negative25/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
export type GalleryResponse = { photos: PhotoSummary[]; pagination: { nextCursor: string | null; hasMore: boolean } };

export type AuthSessionBridge = {
  get: () => { accessToken: string | null; refreshToken: string | null };
  set: (session: { accessToken: string; refreshToken: string; expiresIn: number }) => void;
  clear: () => void;
  sessionExpiredMessage?: () => string;
};

let authSessionBridge: AuthSessionBridge | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function configureAuthSession(bridge: AuthSessionBridge | null): void {
  authSessionBridge = bridge;
}

export async function fetchGallery(mode: string, cursor?: string, signal?: AbortSignal, location?: string, spaceSlug = 'primary', token?: string | null, limit?: number): Promise<GalleryResponse> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const query = new URLSearchParams({ mode });
  if (cursor) query.set('cursor', cursor);
  if (location) query.set('location', location);
  if (limit !== undefined) query.set('limit', String(limit));
  if (token) return authorized(`/spaces/${encodeURIComponent(spaceSlug)}/photos?${query}`, token, { signal }, (value) => PhotoListResponseSchema.parse(value));
  const response = await fetch(`${apiBaseUrl}/spaces/${encodeURIComponent(spaceSlug)}/photos?${query}`, { signal, headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`Gallery request failed (${response.status})`);
  return PhotoListResponseSchema.parse(await response.json());
}

export async function fetchPhoto(id: string, signal?: AbortSignal, spaceSlug = 'primary', token?: string | null): Promise<PhotoSummary> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  if (token) return authorized(`/spaces/${encodeURIComponent(spaceSlug)}/photos/${encodeURIComponent(id)}`, token, { signal }, (value) => PhotoSummarySchema.parse(value));
  const publicPath = spaceSlug === 'primary' ? `/photos/${encodeURIComponent(id)}` : `/spaces/${encodeURIComponent(spaceSlug)}/photos/${encodeURIComponent(id)}`;
  const response = await fetch(`${apiBaseUrl}${publicPath}`, { signal, headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`Photo request failed (${response.status})`);
  return PhotoSummarySchema.parse(await response.json());
}

export async function fetchDiscoverLocations(query?: string, signal?: AbortSignal, spaceSlug?: string): Promise<DiscoverLocationRecord[]> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const params = new URLSearchParams();
  if (query?.trim()) params.set('q', query.trim());
  if (spaceSlug) params.set('spaceSlug', spaceSlug);
  const response = await fetch(`${apiBaseUrl}/discover/locations${params.size ? `?${params}` : ''}`, { signal, headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`Locations request failed (${response.status})`);
  return DiscoverLocationsResponseSchema.parse(await response.json()).locations;
}

export function isApiConfigured(): boolean { return Boolean(apiBaseUrl); }

export type AdminPhoto = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  published: boolean;
  hidden: boolean;
  ownerOnly?: boolean;
  rating: number | null;
  thumbnail?: { url: string; width: number; height: number; format: string };
  location: { id: string; name: string } | null;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
};

export async function fetchWorkspaces(token: string): Promise<Workspace[]> {
  return authorized('/workspaces', token, {}, (value) => WorkspaceSchema.array().parse(value));
}

export async function login(identifier: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': crypto.randomUUID() }, body: JSON.stringify({ identifier, password }) });
  if (!response.ok) throw new Error('Invalid email or password');
  return SessionSchema.parse(await response.json());
}

export async function logout(refreshToken: string | null): Promise<void> {
  if (!apiBaseUrl) return;
  const response = await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': crypto.randomUUID() }, body: JSON.stringify({ refreshToken }) });
  if (!response.ok) throw new Error(`Logout request failed (${response.status})`);
}

export async function registerAccount(input: { username: string; email: string; password: string; passwordConfirmation: string }): Promise<{ session: { accessToken: string; refreshToken: string; expiresIn: number }; user: unknown; verificationRequired: boolean; devVerification?: { token: string; code: string } }> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': crypto.randomUUID() }, body: JSON.stringify(input) });
  if (!response.ok) {
    let message = response.status === 409 ? 'Username or email is already in use' : 'Registration failed';
    try { const body = await response.json() as { error?: { message?: string } }; if (body.error?.message) message = body.error.message; } catch { /* Keep the status fallback. */ }
    throw new Error(message);
  }
  const body = await response.json() as { session: unknown; user: unknown; verificationRequired: boolean; devVerification?: { token: string; code: string } };
  return { ...body, session: SessionSchema.parse(body.session), user: UserSchema.parse(body.user) };
}

export async function verifyEmail(input: { email?: string; token?: string; code?: string }): Promise<unknown> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/auth/email/verify`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': crypto.randomUUID() }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error('Verification failed or expired');
  return UserSchema.parse((await response.json() as { user: unknown }).user);
}

export async function fetchCurrentUser(token: string): Promise<{ id: string; username?: string; email: string; name: string | null; emailVerifiedAt?: string | null }> {
  return authorized('/auth/me', token, {}, (value) => UserSchema.parse(value));
}

export async function fetchUserProfile(token: string): Promise<UserProfile> {
  return authorized('/me/profile', token, {}, (value) => UserProfileSchema.parse(value));
}

export async function patchUserProfile(token: string, input: Record<string, unknown>): Promise<UserProfile> {
  return authorized('/me/profile', token, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(UserProfilePatchSchema.parse(input)) }, (value) => UserProfileSchema.parse(value));
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(username)}/profile`, { headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
  return PublicProfileSchema.parse(await response.json());
}

export async function searchPublicUsers(query: string): Promise<PublicProfileSearchResult[]> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/users/search?q=${encodeURIComponent(query.trim())}`, { headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`User search failed (${response.status})`);
  return PublicProfileSearchResponseSchema.parse(await response.json()).users;
}

async function authorized<T>(path: string, token: string, init: RequestInit = {}, parse: (value: unknown) => T, allowRefresh = true): Promise<T> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-request-id', crypto.randomUUID());
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (response.status === 401 && allowRefresh && authSessionBridge) {
    // A different request may already have rotated the refresh token. Reuse its access token first.
    const latestAccessToken = authSessionBridge.get().accessToken;
    if (latestAccessToken && latestAccessToken !== token) return authorized(path, latestAccessToken, init, parse, false);
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken && nextAccessToken !== token) return authorized(path, nextAccessToken, init, parse, false);
    throw new Error(authSessionBridge.sessionExpiredMessage?.() ?? 'Your session has expired. Please sign in again.');
  }
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  if (response.status === 204) return parse(undefined);
  return parse(await response.json());
}

async function refreshAccessToken(): Promise<string | null> {
  if (!apiBaseUrl || !authSessionBridge) return null;
  if (refreshPromise) return refreshPromise;
  const current = authSessionBridge.get();
  if (!current.refreshToken) return null;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': crypto.randomUUID() },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
      const session = SessionSchema.parse(await response.json());
      authSessionBridge?.set(session);
      return session.accessToken;
    } catch {
      authSessionBridge?.clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function createImportBatch(spaceSlug: string, sourceKeys: string[], token: string): Promise<unknown> {
  return authorized('/imports', token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spaceSlug, sourceKeys }) }, (value) => value);
}

type UploadReservation = { uploadId: string; key: string; url: string; expiresIn: number };
type MultipartSession = { id: string; key: string; storageUploadId: string; partSize: number; partCount: number; expiresAt: string; status: string };
type MultipartPart = { partNumber: number; etag: string; size: number };
type MultipartStatus = { upload: MultipartSession; parts: MultipartPart[] };
export type UploadProgress = { uploadedBytes: number; totalBytes: number; phase: 'uploading' | 'completing' };
export type UploadOptions = { signal?: AbortSignal; onProgress?: (progress: UploadProgress) => void };

const multipartThreshold = 32 * 1024 * 1024;
const partConcurrency = 4;
const maxPartRetries = 3;
const resumeStorageKey = 'negative25.multipart-uploads';

export async function uploadPhoto(spaceSlug: string, file: File, token: string, options: UploadOptions = {}): Promise<string> {
  if (file.size >= multipartThreshold) return uploadMultipartPhoto(spaceSlug, file, token, options);
  const contentType = contentTypeFor(file);
  const reservation = await authorized<UploadReservation>('/media/upload-url', token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spaceSlug, filename: file.name, contentType, byteSize: file.size }) }, (value) => value as UploadReservation);
  if (reservation.url.startsWith('memory://')) {
    const body = await file.arrayBuffer();
    await authorized<{ key: string }>('/media/upload-content', token, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-space-slug': spaceSlug,
        'x-upload-key': reservation.key,
        'x-expected-byte-size': String(file.size),
        'x-expected-content-type': contentType,
      },
      body,
    }, (value) => value as { key: string });
    options.onProgress?.({ uploadedBytes: file.size, totalBytes: file.size, phase: 'uploading' });
    return reservation.key;
  }
  await putWithRetry(reservation.url, file, { 'content-type': contentType }, options.signal, 'Upload failed');
  options.onProgress?.({ uploadedBytes: file.size, totalBytes: file.size, phase: 'uploading' });
  await authorized('/media/complete', token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spaceSlug, key: reservation.key, expectedByteSize: file.size, expectedContentType: contentType }) }, (value) => value);
  return reservation.key;
}

async function uploadMultipartPhoto(spaceSlug: string, file: File, token: string, options: UploadOptions): Promise<string> {
  const contentType = contentTypeFor(file);
  const resume = (await readResumeRecords()).find((record) => record.spaceSlug === spaceSlug && record.name === file.name && record.size === file.size && record.lastModified === file.lastModified && record.type === contentType);
  let status: MultipartStatus | undefined;
  if (resume) {
    try { status = await getMultipartStatus(resume.session.id, spaceSlug, token); } catch { await removeResumeRecord(resume.session.id); }
  }
  if (!status) {
    const session = await authorized<MultipartSession>('/media/multipart/initiate', token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spaceSlug, filename: file.name, contentType, byteSize: file.size }) }, (value) => value as MultipartSession);
    status = { upload: session, parts: [] };
    await saveResumeRecord({ spaceSlug, name: file.name, size: file.size, lastModified: file.lastModified, type: contentType, session });
  }
  if (status.upload.status === 'completed') { await removeResumeRecord(status.upload.id); return status.upload.key; }
  const completed = new Map(status.parts.map((part) => [part.partNumber, part]));
  let uploadedBytes = [...completed.values()].reduce((sum, part) => sum + part.size, 0);
  options.onProgress?.({ uploadedBytes, totalBytes: file.size, phase: 'uploading' });
  const missing = Array.from({ length: status.upload.partCount }, (_, index) => index + 1).filter((partNumber) => !completed.has(partNumber));
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < missing.length) {
      throwIfAborted(options.signal);
      const partNumber = missing[cursor++];
      const start = (partNumber - 1) * status!.upload.partSize;
      const end = Math.min(file.size, start + status!.upload.partSize);
      const body = file.slice(start, end);
      let etag = '';
      let lastError: unknown;
      for (let attempt = 0; attempt < maxPartRetries; attempt += 1) {
        try {
          const partUrl = await requestMultipartPartUrl(status!.upload.id, spaceSlug, partNumber, token);
          const response = await putWithRetry(partUrl, body, undefined, options.signal, `Part ${partNumber} upload failed`);
          etag = response.headers.get('etag')?.trim() ?? '';
          if (!etag) throw new Error(`Part ${partNumber} response did not include an ETag`);
          break;
        } catch (error) {
          lastError = error;
          if (attempt + 1 < maxPartRetries) await delay(300 * 2 ** attempt, options.signal);
        }
      }
      if (!etag) throw lastError instanceof Error ? lastError : new Error(`Part ${partNumber} upload failed`);
      completed.set(partNumber, { partNumber, etag, size: body.size });
      uploadedBytes += body.size;
      options.onProgress?.({ uploadedBytes, totalBytes: file.size, phase: 'uploading' });
    }
  };
  await Promise.all(Array.from({ length: Math.min(partConcurrency, missing.length || 1) }, () => worker()));
  throwIfAborted(options.signal);
  options.onProgress?.({ uploadedBytes: file.size, totalBytes: file.size, phase: 'completing' });
  await authorized(`/media/multipart/${encodeURIComponent(status.upload.id)}/complete`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spaceSlug, parts: [...completed.values()].sort((a, b) => a.partNumber - b.partNumber).map(({ partNumber, etag }) => ({ partNumber, etag })) }) }, (value) => value);
  await removeResumeRecord(status.upload.id);
  return status.upload.key;
}

async function getMultipartStatus(id: string, spaceSlug: string, token: string): Promise<MultipartStatus> {
  return authorized<MultipartStatus>(`/media/multipart/${encodeURIComponent(id)}/status?spaceSlug=${encodeURIComponent(spaceSlug)}`, token, {}, (value) => value as MultipartStatus);
}

async function requestMultipartPartUrl(id: string, spaceSlug: string, partNumber: number, token: string): Promise<string> {
  const result = await authorized<{ url: string }>(`/media/multipart/${encodeURIComponent(id)}/part-url`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spaceSlug, partNumber }) }, (value) => value as { url: string });
  return result.url;
}

async function putWithRetry(url: string, body: BodyInit, headers: HeadersInit | undefined, signal: AbortSignal | undefined, message: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxPartRetries; attempt += 1) {
    try {
      throwIfAborted(signal);
      const response = await fetch(url, { method: 'PUT', headers, body, signal });
      if (!response.ok) throw new Error(`${message} (${response.status})`);
      return response;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt + 1 < maxPartRetries) await delay(300 * 2 ** attempt, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(message);
}

function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Upload was cancelled', 'AbortError'); }
function delay(ms: number, signal?: AbortSignal): Promise<void> { return new Promise((resolve, reject) => { const timer = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Upload was cancelled', 'AbortError')); }, { once: true }); }); }

type ResumeRecord = { spaceSlug: string; name: string; size: number; lastModified: number; type: string; session: MultipartSession };
const resumeDatabaseName = 'negative25-upload-state';
const resumeStoreName = 'sessions';
async function readResumeRecords(): Promise<ResumeRecord[]> {
  const database = await openResumeDatabase();
  if (!database) return readLocalResumeRecords();
  return new Promise((resolve) => {
    const request = database.transaction(resumeStoreName, 'readonly').objectStore(resumeStoreName).getAll();
    request.onsuccess = () => { database.close(); resolve(Array.isArray(request.result) ? request.result as ResumeRecord[] : []); };
    request.onerror = () => { database.close(); resolve(readLocalResumeRecords()); };
  });
}
async function saveResumeRecord(record: ResumeRecord): Promise<void> {
  const database = await openResumeDatabase();
  if (!database) { saveLocalResumeRecord(record); return; }
  return new Promise((resolve) => {
    const transaction = database.transaction(resumeStoreName, 'readwrite');
    transaction.objectStore(resumeStoreName).put(record, record.session.id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); saveLocalResumeRecord(record); resolve(); };
  });
}
async function removeResumeRecord(id: string): Promise<void> {
  const database = await openResumeDatabase();
  if (!database) { removeLocalResumeRecord(id); return; }
  return new Promise((resolve) => {
    const transaction = database.transaction(resumeStoreName, 'readwrite');
    transaction.objectStore(resumeStoreName).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); removeLocalResumeRecord(id); resolve(); };
  });
}
function openResumeDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(resumeDatabaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(resumeStoreName); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}
function readLocalResumeRecords(): ResumeRecord[] { if (typeof localStorage === 'undefined') return []; try { const value = JSON.parse(localStorage.getItem(resumeStorageKey) ?? '[]'); return Array.isArray(value) ? value as ResumeRecord[] : []; } catch { return []; } }
function saveLocalResumeRecord(record: ResumeRecord): void { if (typeof localStorage === 'undefined') return; const records = readLocalResumeRecords().filter((item) => item.session.id !== record.session.id); records.push(record); localStorage.setItem(resumeStorageKey, JSON.stringify(records.slice(-20))); }
function removeLocalResumeRecord(id: string): void { if (typeof localStorage === 'undefined') return; localStorage.setItem(resumeStorageKey, JSON.stringify(readLocalResumeRecords().filter((item) => item.session.id !== id))); }

function contentTypeFor(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'heic' ? 'image/heic' : extension === 'heif' ? 'image/heif' : 'image/jpeg';
}

export async function previewImportBatch(batchId: string, token: string, spaceSlug = 'primary'): Promise<ImportPreview> {
  return authorized<ImportPreview>(`/spaces/${encodeURIComponent(spaceSlug)}/imports/${encodeURIComponent(batchId)}/preview`, token, { method: 'POST' }, (value) => ImportPreviewSchema.parse(value));
}

export async function confirmImportBatch(batchId: string, token: string, spaceSlug = 'primary'): Promise<ImportPreview> {
  return authorized<ImportPreview>(`/spaces/${encodeURIComponent(spaceSlug)}/imports/${encodeURIComponent(batchId)}/confirm`, token, { method: 'POST' }, (value) => ImportPreviewSchema.parse(value));
}

export async function fetchImportBatch(batchId: string, token: string, spaceSlug = 'primary'): Promise<ImportPreview> {
  return authorized<ImportPreview>(`/spaces/${encodeURIComponent(spaceSlug)}/imports/${encodeURIComponent(batchId)}`, token, {}, (value) => ImportPreviewSchema.parse(value));
}

export async function retryImportBatch(batchId: string, token: string, spaceSlug = 'primary'): Promise<ImportPreview> {
  return authorized<ImportPreview>(`/spaces/${encodeURIComponent(spaceSlug)}/imports/${encodeURIComponent(batchId)}/retry`, token, { method: 'POST' }, (value) => ImportPreviewSchema.parse(value));
}

export async function publishImportBatch(batchId: string, token: string, spaceSlug = 'primary'): Promise<ImportPublishResponse> {
  return authorized<ImportPublishResponse>(`/spaces/${encodeURIComponent(spaceSlug)}/imports/${encodeURIComponent(batchId)}/publish`, token, { method: 'POST' }, (value) => ImportPublishResponseSchema.parse(value));
}

export async function fetchAdminSummary(spaceSlug: string, token: string): Promise<AdminSummary> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/summary`, token, {}, (value) => AdminSummarySchema.parse(value));
}

export async function listImportBatches(spaceSlug: string, token: string): Promise<ImportBatchSummary[]> {
  return authorized(`/spaces/${encodeURIComponent(spaceSlug)}/imports`, token, {}, (value) => ImportBatchSummarySchema.array().parse(value));
}

export async function listWorkspaceMembers(spaceSlug: string, token: string): Promise<WorkspaceMember[]> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/members`, token, {}, (value) => WorkspaceMemberSchema.array().parse(value));
}

export async function patchWorkspaceMember(spaceSlug: string, userId: string, role: WorkspaceMember['role'], token: string): Promise<WorkspaceMember> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/members/${encodeURIComponent(userId)}`, token, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) }, (value) => WorkspaceMemberSchema.parse(value));
}

export async function listAdminPhotos(spaceSlug: string, token: string): Promise<AdminPhoto[]> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/photos`, token, {}, (value) => value as AdminPhoto[]);
}

export type AdminPhotoLocationPatch = { name: string; latitude: number; longitude: number; displayAddress?: string; displayRegion?: string; displayRegionEnabled?: boolean } | null;

export async function patchAdminPhoto(spaceSlug: string, photoId: string, patch: Partial<Pick<AdminPhoto, 'published' | 'hidden' | 'ownerOnly' | 'title' | 'description' | 'rating'>> & { location?: AdminPhotoLocationPatch }, token: string): Promise<AdminPhoto> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/photos/${encodeURIComponent(photoId)}`, token, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }, (value) => value as AdminPhoto);
}

export async function fetchAlbums(spaceSlug = 'primary', signal?: AbortSignal): Promise<AlbumSummary[]> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/spaces/${encodeURIComponent(spaceSlug)}/albums`, { signal, headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`Albums request failed (${response.status})`);
  const body = await response.json() as { albums: unknown };
  return AlbumSummarySchema.array().parse(body.albums);
}

export async function fetchAlbum(spaceSlug: string, albumId: string, signal?: AbortSignal): Promise<AlbumDetail> {
  if (!apiBaseUrl) throw new Error('API is not configured');
  const response = await fetch(`${apiBaseUrl}/spaces/${encodeURIComponent(spaceSlug)}/albums/${encodeURIComponent(albumId)}`, { signal, headers: { 'x-request-id': crypto.randomUUID() } });
  if (!response.ok) throw new Error(`Album request failed (${response.status})`);
  return AlbumDetailSchema.parse(await response.json());
}

export async function listAdminAlbums(spaceSlug: string, token: string): Promise<AdminAlbum[]> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/albums`, token, {}, (value) => AdminAlbumSchema.array().parse(value));
}

export async function createAdminAlbum(spaceSlug: string, input: { title: string; description?: string; shootDate?: string | null; coverPhotoId?: string | null; photoIds?: string[] }, token: string): Promise<AdminAlbum> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/albums`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, (value) => AdminAlbumSchema.parse(value));
}

export async function patchAdminAlbum(spaceSlug: string, id: string, input: Partial<{ title: string; description: string; shootDate: string | null; coverPhotoId: string | null; photoIds: string[] }>, token: string): Promise<AdminAlbum> {
  return authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/albums/${encodeURIComponent(id)}`, token, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }, (value) => AdminAlbumSchema.parse(value));
}

export async function deleteAdminAlbum(spaceSlug: string, id: string, token: string): Promise<void> {
  await authorized(`/admin/spaces/${encodeURIComponent(spaceSlug)}/albums/${encodeURIComponent(id)}`, token, { method: 'DELETE' }, () => undefined);
}
