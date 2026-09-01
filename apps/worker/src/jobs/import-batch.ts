import type { Job } from 'bullmq';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import sharp from 'sharp';
import type { ImportJob, ImportStatus } from '@negative25/contracts';
import { fetchElevation } from '@negative25/utils';
import { readExif } from '../metadata/exif-reader.js';
import { generateVariants } from '../media/variants.js';
import type { ImportedPhoto, ImportPersistence } from '../persistence.js';
import type { ObjectStorage } from '../storage.js';

export type ImportItemState = { id: string; status: ImportStatus; errors: string[]; warnings: string[] };
const transitions: Record<ImportStatus, readonly ImportStatus[]> = {
  uploaded: ['preview', 'cancelled'], preview: ['queued', 'cancelled'], queued: ['processing', 'cancelled'], processing: ['completed', 'failed', 'cancelled'], completed: [], failed: ['queued', 'cancelled'], cancelled: [],
};

export function transitionItem(item: ImportItemState, next: ImportStatus): ImportItemState {
  if (!transitions[item.status].includes(next)) throw new Error(`Invalid import transition: ${item.status} -> ${next}`);
  return { ...item, status: next };
}

export async function processImportItem(job: Job<ImportJob>, process: (item: ImportJob) => Promise<void>): Promise<void> {
  await process(job.data);
}

export type ImportProcessorDependencies = { persistence: ImportPersistence; storage: ObjectStorage };

/** Processes one queue item. Re-delivered jobs are ignored once the item left queued state. */
export async function processImportJob(job: ImportJob, dependencies: ImportProcessorDependencies): Promise<void> {
  const item = await dependencies.persistence.markProcessing(job);
  if (!item) return;
  let warnings: string[] = [];
  try {
    const workspacePrefix = `workspaces/${job.workspaceId}/`;
    if (!item.sourceKey.startsWith(workspacePrefix) || item.sourceKey.includes('..')) throw new Error('Source object is outside the workspace');
    const source = await dependencies.storage.getObject(item.sourceKey);
    if (source.byteLength === 0) throw new Error('Source object is empty');
    const checksum = createHash('sha256').update(source).digest('hex');
    const image = await sharp(source).metadata();
    if (!image.width || !image.height) throw new Error('Unable to read image dimensions');
    const exif = await readExif(source);
    warnings = [...exif.warnings];
    const fields: Record<string, unknown> = { ...item.resolvedFields, ...exif.fields };
    await fillMissingElevation(fields);
    const rating = normalizeRating(fields.rating, warnings);
    if (rating === undefined) delete fields.rating;
    else fields.rating = rating;
    if (fields.latitude !== undefined && fields.longitude !== undefined && fields.locationSource === undefined) fields.locationSource = 'exif';
    fields.width ??= image.width;
    fields.height ??= image.height;
    const variants = await generateVariants(source);
    const photoId = stablePhotoId(job.workspaceId, checksum);
    const originalFormat = image.format ?? extensionFormat(item.sourceKey);
    const originalKey = `workspaces/${job.workspaceId}/photos/${photoId}/original.${originalFormat}`;
    const title = stringValue(fields.title) ?? filenameTitle(item.sourceKey);
    const description = stringValue(fields.description) ?? '';
    const files = [
      {
        kind: 'original' as const,
        storageKey: originalKey,
        checksum,
        width: image.width,
        height: image.height,
        format: originalFormat,
        byteSize: source.byteLength,
        isPrivate: true,
      },
      ...variants.map((variant) => ({
        kind: variant.kind,
        storageKey: `workspaces/${job.workspaceId}/photos/${photoId}/${variant.kind}.jpg`,
        checksum: createHash('sha256').update(variant.body).digest('hex'),
        width: variant.width,
        height: variant.height,
        format: variant.format,
        byteSize: variant.byteSize,
        isPrivate: false,
      })),
    ];
    await dependencies.storage.putObject({ key: originalKey, body: source, contentType: contentTypeForFormat(originalFormat) });
    for (const variant of variants) {
      const storageKey = `workspaces/${job.workspaceId}/photos/${photoId}/${variant.kind}.jpg`;
      await dependencies.storage.putObject({ key: storageKey, body: variant.body, contentType: variant.contentType });
    }
    const photo: ImportedPhoto = {
      id: photoId,
      workspaceId: job.workspaceId,
      checksum,
      title,
      description,
      capturedAt: stringValue(fields.capturedAt),
      capturedAtLocal: stringValue(fields.capturedAtLocal),
      latitude: numberValue(fields.latitude),
      longitude: numberValue(fields.longitude),
      rating,
      metadata: fields,
      files,
    };
    await dependencies.persistence.completeItem(job, photo, warnings, fields);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process image';
    await dependencies.persistence.failItem(job, message, warnings);
  }
}

async function fillMissingElevation(fields: Record<string, unknown>): Promise<void> {
  if (numberValue(fields.altitude) !== undefined) return;
  const latitude = numberValue(fields.latitude);
  const longitude = numberValue(fields.longitude);
  if (latitude === undefined || longitude === undefined) return;
  const elevation = await fetchElevation({ latitude, longitude }, process.env.N25_ELEVATION_API_URL);
  if (elevation !== undefined) fields.altitude = elevation;
}

function stablePhotoId(workspaceId: string, checksum: string): string {
  return createHash('sha256').update(`${workspaceId}:${checksum}`).digest('hex');
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result || undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function normalizeRating(value: unknown, warnings: string[]): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const rating = numberValue(value);
  if (rating === undefined || !Number.isInteger(rating) || rating < 0 || rating > 7) {
    warnings.push('Rating must be an integer from 0 to 7');
    return undefined;
  }
  return rating;
}

function filenameTitle(sourceKey: string): string {
  const name = basename(sourceKey);
  const extension = extname(name);
  return (extension ? name.slice(0, -extension.length) : name).replace(/[_-]+/g, ' ').trim() || 'Untitled photograph';
}

function extensionFormat(sourceKey: string): string {
  return extname(sourceKey).replace('.', '').toLowerCase() || 'jpeg';
}

function contentTypeForFormat(format: string): string {
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'avif') return 'image/avif';
  if (format === 'heic' || format === 'heif') return 'image/heic';
  return 'image/jpeg';
}
