import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '@negative25/utils';
import type { StorageAdapter } from './storage.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

export type MediaActor = { userId: string; workspaceId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type UploadRequest = { filename: string; contentType: string; byteSize: number };
export type CompletedUpload = { id: string; workspaceId: string; sourceKey: string; status: 'uploaded'; checksum?: string; contentType: string; byteSize: number };

export class MediaService {
  private readonly uploads = new Map<string, CompletedUpload>();
  constructor(private readonly storage: StorageAdapter) {}

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
}

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
