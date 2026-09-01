import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '@negative25/utils';
import type { AppRepository, MediaUploadRecord, MediaUploadStatus } from '../../db/repository.js';
import type { MultipartPart, StorageAdapter } from './storage.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const multipartThreshold = 32 * 1024 * 1024;
const basePartSize = 16 * 1024 * 1024;
const maxMultipartParts = 9_000;
const partAlignment = 8 * 1024 * 1024;
const uploadTtlMs = 24 * 60 * 60 * 1000;

export type MediaActor = { userId: string; workspaceId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type UploadRequest = { filename: string; contentType: string; byteSize: number; checksum?: string };
export type CompletedUpload = { id: string; workspaceId: string; sourceKey: string; status: 'uploaded'; checksum?: string; contentType: string; byteSize: number };
export type MultipartUploadSession = {
  id: string;
  key: string;
  storageUploadId: string;
  partSize: number;
  partCount: number;
  expiresAt: string;
  status: MediaUploadStatus;
};
export type MultipartCompletedPart = { partNumber: number; etag: string };

export class MediaService {
  private readonly uploads = new Map<string, CompletedUpload>();
  private readonly localMultipart = new Map<string, MediaUploadRecord>();
  constructor(private readonly storage: StorageAdapter, private readonly repository?: AppRepository) {}

  async createUploadUrl(actor: MediaActor, input: UploadRequest): Promise<{ uploadId: string; key: string; url: string; expiresIn: number }> {
    this.requireEditor(actor);
    if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) throw new ApiError('VALIDATION_ERROR', 'Invalid upload size');
    const contentType = input.contentType.toLowerCase();
    if (!allowedTypes.has(contentType)) throw new ApiError('UNSUPPORTED_IMAGE_FORMAT', 'Unsupported image format');
    const extension = input.filename.toLowerCase().split('.').pop() ?? '';
    if (!allowedExtensions.has(extension)) throw new ApiError('UNSUPPORTED_IMAGE_FORMAT', 'Unsupported image extension');
    const uploadId = randomUUID();
    const filename = safeFilename(input.filename, extension);
    const key = `workspaces/${actor.workspaceId}/uploads/${uploadId}/${filename}`;
    const url = await this.storage.createUploadUrl({ key, contentType, expiresInSeconds: 900 });
    return { uploadId, key, url, expiresIn: 900 };
  }

  async completeUpload(actor: MediaActor, input: { key: string; expectedByteSize: number; expectedContentType: string; checksum?: string }): Promise<CompletedUpload> {
    this.requireEditor(actor);
    const prefix = `workspaces/${actor.workspaceId}/uploads/`;
    if (!input.key.startsWith(prefix) || input.key.includes('..')) throw new ApiError('FORBIDDEN', 'Upload does not belong to workspace');
    const object = await this.storage.headObject(input.key);
    if (!object) throw new ApiError('UPLOAD_NOT_FOUND', 'Uploaded object not found');
    if (object.size !== input.expectedByteSize) throw new ApiError('UPLOAD_METADATA_MISMATCH', 'Uploaded byte size does not match');
    if (object.contentType.toLowerCase() !== input.expectedContentType.toLowerCase()) throw new ApiError('UPLOAD_METADATA_MISMATCH', 'Uploaded content type does not match');
    const completed: CompletedUpload = { id: randomUUID(), workspaceId: actor.workspaceId, sourceKey: input.key, status: 'uploaded', checksum: input.checksum, contentType: object.contentType, byteSize: object.size };
    this.uploads.set(completed.id, completed);
    return completed;
  }

  async initiateMultipart(actor: MediaActor, input: UploadRequest): Promise<MultipartUploadSession> {
    this.requireEditor(actor);
    const validated = validateUpload(input);
    const id = randomUUID();
    const partSize = calculatePartSize(input.byteSize);
    const partCount = Math.ceil(input.byteSize / partSize);
    const key = `workspaces/${actor.workspaceId}/uploads/${id}/${validated.filename}`;
    const storageUpload = await this.storage.createMultipartUpload({ key, contentType: validated.contentType });
    const record: MediaUploadRecord = {
      id,
      workspaceId: actor.workspaceId,
      createdBy: actor.userId,
      storageKey: key,
      storageUploadId: storageUpload.uploadId,
      filename: validated.filename,
      contentType: validated.contentType,
      byteSize: input.byteSize,
      checksum: input.checksum ?? null,
      partSize,
      partCount,
      status: 'initiated',
      expiresAt: new Date(Date.now() + uploadTtlMs),
      completedAt: null,
    };
    try {
      await this.saveMultipartRecord(record);
    } catch (error) {
      await this.storage.abortMultipartUpload(key, storageUpload.uploadId).catch(() => undefined);
      throw error;
    }
    return toMultipartSession(record);
  }

  async createMultipartPartUrl(actor: MediaActor, id: string, partNumber: number): Promise<string> {
    const record = await this.requireMultipartRecord(actor, id);
    if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > record.partCount) throw new ApiError('VALIDATION_ERROR', 'Invalid multipart part number');
    return this.storage.createPartUploadUrl({ key: record.storageKey, uploadId: record.storageUploadId, partNumber, expiresInSeconds: 900 });
  }

  async getMultipartStatus(actor: MediaActor, id: string): Promise<{ upload: MultipartUploadSession; parts: MultipartPart[] }> {
    const record = await this.requireMultipartRecord(actor, id);
    const parts = record.status === 'initiated' ? await this.storage.listParts(record.storageKey, record.storageUploadId) : [];
    return { upload: toMultipartSession(record), parts };
  }

  async completeMultipart(actor: MediaActor, id: string, submittedParts: MultipartCompletedPart[]): Promise<CompletedUpload> {
    const record = await this.requireMultipartRecord(actor, id);
    if (record.status === 'completed') return { id: record.id, workspaceId: record.workspaceId, sourceKey: record.storageKey, status: 'uploaded', checksum: record.checksum ?? undefined, contentType: record.contentType, byteSize: record.byteSize };
    if (record.status !== 'initiated') throw new ApiError('UPLOAD_EXPIRED', 'Multipart upload is no longer active');
    if (!submittedParts.length || submittedParts.length > record.partCount) throw new ApiError('VALIDATION_ERROR', 'Invalid multipart parts');
    const uniqueParts = new Map<number, MultipartCompletedPart>();
    for (const part of submittedParts) {
      if (!Number.isSafeInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > record.partCount || !part.etag.trim()) throw new ApiError('VALIDATION_ERROR', 'Invalid multipart part');
      if (uniqueParts.has(part.partNumber)) throw new ApiError('VALIDATION_ERROR', 'Duplicate multipart part');
      uniqueParts.set(part.partNumber, { partNumber: part.partNumber, etag: part.etag.trim() });
    }
    const storedParts = await this.storage.listParts(record.storageKey, record.storageUploadId);
    const storedByNumber = new Map(storedParts.map((part) => [part.partNumber, part]));
    const ordered = [...uniqueParts.values()].sort((a, b) => a.partNumber - b.partNumber);
    if (ordered.length !== storedParts.length || ordered.some((part, index) => part.partNumber !== index + 1)) throw new ApiError('UPLOAD_INCOMPLETE', 'Multipart upload is missing parts');
    let totalSize = 0;
    for (const part of ordered) {
      const stored = storedByNumber.get(part.partNumber);
      if (!stored || normalizeEtag(stored.etag) !== normalizeEtag(part.etag)) throw new ApiError('UPLOAD_METADATA_MISMATCH', 'Multipart ETag does not match');
      totalSize += stored.size;
    }
    if (totalSize !== record.byteSize) throw new ApiError('UPLOAD_METADATA_MISMATCH', 'Multipart byte size does not match');
    await this.storage.completeMultipartUpload({ key: record.storageKey, uploadId: record.storageUploadId, parts: ordered });
    const object = await this.storage.headObject(record.storageKey);
    if (!object || object.size !== record.byteSize || object.contentType.toLowerCase() !== record.contentType.toLowerCase()) throw new ApiError('UPLOAD_METADATA_MISMATCH', 'Completed object metadata does not match');
    const updated = await this.updateMultipartRecord(record, { status: 'completed', completedAt: new Date() });
    return { id: updated.id, workspaceId: updated.workspaceId, sourceKey: updated.storageKey, status: 'uploaded', checksum: updated.checksum ?? undefined, contentType: updated.contentType, byteSize: updated.byteSize };
  }

  async abortMultipart(actor: MediaActor, id: string): Promise<void> {
    const record = await this.requireMultipartRecord(actor, id);
    if (record.status === 'completed') throw new ApiError('CONFLICT', 'Completed upload cannot be aborted');
    if (record.status !== 'initiated') return;
    await this.storage.abortMultipartUpload(record.storageKey, record.storageUploadId);
    await this.updateMultipartRecord(record, { status: 'aborted' });
  }

  async cleanupExpiredUploads(now = new Date()): Promise<number> {
    const records = this.repository ? await this.repository.listExpiredMediaUploads(now) : [...this.localMultipart.values()].filter((record) => record.status === 'initiated' && record.expiresAt <= now);
    let cleaned = 0;
    for (const record of records) {
      await this.storage.abortMultipartUpload(record.storageKey, record.storageUploadId).catch(() => undefined);
      await this.updateMultipartRecord(record, { status: 'expired' });
      cleaned += 1;
    }
    return cleaned;
  }

  async uploadContent(actor: MediaActor, input: { key: string; expectedByteSize: number; expectedContentType: string; body: Uint8Array }): Promise<CompletedUpload> {
    this.requireEditor(actor);
    const prefix = `workspaces/${actor.workspaceId}/uploads/`;
    if (!input.key.startsWith(prefix) || input.key.includes('..')) throw new ApiError('FORBIDDEN', 'Upload does not belong to workspace');
    if (!Number.isSafeInteger(input.expectedByteSize) || input.expectedByteSize <= 0 || input.body.byteLength !== input.expectedByteSize) throw new ApiError('UPLOAD_METADATA_MISMATCH', 'Uploaded byte size does not match');
    const contentType = input.expectedContentType.toLowerCase();
    if (!allowedTypes.has(contentType)) throw new ApiError('UNSUPPORTED_IMAGE_FORMAT', 'Unsupported image format');
    await this.storage.putObject({ key: input.key, size: input.body.byteLength, contentType, body: input.body });
    return this.completeUpload(actor, { key: input.key, expectedByteSize: input.expectedByteSize, expectedContentType: contentType });
  }

  async getPreviewUrl(actor: MediaActor | null, key: string): Promise<string> {
    if (key.includes('..')) throw new ApiError('VALIDATION_ERROR', 'Invalid media key');
    const isPreview = /\/(thumbnail|preview|large)\//.test(key);
    if (isPreview) return this.storage.getPublicUrl(key);
    if (!actor) throw new ApiError('UNAUTHORIZED', 'Authentication required');
    if (!key.startsWith(`workspaces/${actor.workspaceId}/`)) throw new ApiError('FORBIDDEN', 'Media access denied');
    return this.storage.getSignedDownloadUrl(key, 300);
  }

  private requireEditor(actor: MediaActor): void { if (!['owner', 'admin', 'editor'].includes(actor.role)) throw new ApiError('FORBIDDEN', 'Editor access required'); }

  private async saveMultipartRecord(record: MediaUploadRecord): Promise<void> {
    if (this.repository) await this.repository.createMediaUpload(record);
    else this.localMultipart.set(record.id, record);
  }

  private async findMultipartRecord(id: string, workspaceId: string): Promise<MediaUploadRecord | undefined> {
    if (this.repository) return this.repository.findMediaUpload(id, workspaceId);
    const record = this.localMultipart.get(id);
    return record?.workspaceId === workspaceId ? { ...record } : undefined;
  }

  private async updateMultipartRecord(record: MediaUploadRecord, patch: Partial<Pick<MediaUploadRecord, 'status' | 'completedAt'>>): Promise<MediaUploadRecord> {
    if (this.repository) {
      const updated = await this.repository.updateMediaUpload(record.id, record.workspaceId, patch);
      if (!updated) throw new ApiError('UPLOAD_NOT_FOUND', 'Multipart upload not found');
      return updated;
    }
    const updated = { ...record, ...patch, updatedAt: new Date() };
    this.localMultipart.set(updated.id, updated);
    return updated;
  }

  private async requireMultipartRecord(actor: MediaActor, id: string): Promise<MediaUploadRecord> {
    this.requireEditor(actor);
    const record = await this.findMultipartRecord(id, actor.workspaceId);
    if (!record) throw new ApiError('UPLOAD_NOT_FOUND', 'Multipart upload not found');
    if (record.createdBy !== actor.userId && !['owner', 'admin'].includes(actor.role)) throw new ApiError('FORBIDDEN', 'Multipart upload access denied');
    if (record.status === 'initiated' && record.expiresAt <= new Date()) {
      await this.storage.abortMultipartUpload(record.storageKey, record.storageUploadId).catch(() => undefined);
      await this.updateMultipartRecord(record, { status: 'expired' });
      throw new ApiError('UPLOAD_EXPIRED', 'Multipart upload has expired');
    }
    return record;
  }
}

export function calculatePartSize(byteSize: number): number {
  const required = Math.max(basePartSize, Math.ceil(byteSize / maxMultipartParts));
  return Math.ceil(required / partAlignment) * partAlignment;
}

export function shouldUseMultipart(byteSize: number): boolean { return byteSize >= multipartThreshold; }

function validateUpload(input: UploadRequest): { contentType: string; filename: string } {
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) throw new ApiError('VALIDATION_ERROR', 'Invalid upload size');
  const contentType = input.contentType.toLowerCase();
  if (!allowedTypes.has(contentType)) throw new ApiError('UNSUPPORTED_IMAGE_FORMAT', 'Unsupported image format');
  const extension = input.filename.toLowerCase().split('.').pop() ?? '';
  if (!allowedExtensions.has(extension)) throw new ApiError('UNSUPPORTED_IMAGE_FORMAT', 'Unsupported image extension');
  return { contentType, filename: safeFilename(input.filename, extension) };
}

function toMultipartSession(record: MediaUploadRecord): MultipartUploadSession {
  return { id: record.id, key: record.storageKey, storageUploadId: record.storageUploadId, partSize: record.partSize, partCount: record.partCount, expiresAt: record.expiresAt.toISOString(), status: record.status };
}

function normalizeEtag(value: string): string { return value.trim().replace(/^"|"$/g, '').toLowerCase(); }

function safeFilename(filename: string, extension: string): string {
  const lastSegment = filename.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, '').trim() ?? '';
  const stem = lastSegment.replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 120);
  return `${stem || 'photo'}.${extension}`;
}

export function sha256(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
