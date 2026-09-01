<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Check, FileImage, Globe2, LoaderCircle, Pause, Play, Send, X } from 'lucide-vue-next';
import exifr from 'exifr';
import { unzipSync } from 'fflate';
import type { ImportBatchSummary, ImportPreview } from '@negative25/contracts';
import { RouterLink } from 'vue-router';
import ImportDropzone from '../../components/admin/ImportDropzone.vue';
import { confirmImportBatch, createImportBatch, fetchImportBatch, isApiConfigured, listImportBatches, previewImportBatch, publishImportBatch, retryImportBatch, uploadPhoto, type UploadProgress } from '../../api/client';
import { useSessionStore } from '../../stores/session';
import { useWorkspaceStore } from '../../stores/workspace';
import { useLocale } from '../../i18n';
const files = ref<File[]>([]);
type ExifState = 'reading' | 'ready' | 'empty' | 'error';
type FileMetadata = {
  file: File;
  previewUrl: string;
  state: ExifState;
  capturedAt?: string;
  camera?: string;
  lens?: string;
  exposure?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  gps?: string;
  altitude?: string;
  rating?: string;
  dimensions?: string;
  error?: string;
};
const metadata = ref<FileMetadata[]>([]);
const batch = ref<ImportPreview | null>(null);
const batchWorkspaceSlug = ref<string | null>(null);
const history = ref<ImportBatchSummary[]>([]);
const historyLoading = ref(false);
const historyError = ref<string | null>(null);
const selectedHistoryId = ref<string | null>(null);
const historyDetail = ref<ImportPreview | null>(null);
const historyDetailLoading = ref(false);
const historyDetailError = ref<string | null>(null);
const publishingHistoryId = ref<string | null>(null);
const expandingSelection = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const uploadProgress = ref<Record<string, UploadProgress>>({});
const uploadPaused = ref(false);
let uploadAbortController: AbortController | undefined;
const session = useSessionStore();
const workspace = useWorkspaceStore();
const { t } = useLocale();
const totalSize = computed(() => `${(files.value.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB`);
const isQueued = computed(() => batch.value?.status === 'queued' || batch.value?.status === 'processing');
const isFinished = computed(() => batch.value?.status === 'completed' || batch.value?.status === 'failed' || batch.value?.status === 'cancelled');
const historyPublishedCount = computed(() => historyDetail.value?.publishedCount ?? 0);
const historyAlreadyPublished = computed(() => Boolean(historyDetail.value && historyPublishedCount.value > 0));
let pollTimer: ReturnType<typeof setTimeout> | undefined;
async function onFiles(next: File[]): Promise<void> {
  if (expandingSelection.value) return;
  expandingSelection.value = true;
  batch.value = null;
  error.value = null;
  try {
    const expanded = await expandPhotoSelection(next);
    const existing = new Set(files.value.map(fileFingerprint));
    const accepted = expanded.files.filter((file) => {
      const fingerprint = fileFingerprint(file);
      if (existing.has(fingerprint)) return false;
      existing.add(fingerprint);
      return true;
    });
    files.value = [...files.value, ...accepted];
    metadata.value = [...metadata.value, ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file), state: 'reading' as const }))];
    if (!accepted.length) error.value = expanded.archiveError ? t('admin.archiveReadError') : t('admin.invalidFileType');
    else if (expanded.archiveError || expanded.ignoredFiles) error.value = expanded.archiveError ? t('admin.archiveReadError') : t('admin.invalidFileType');
    for (const file of accepted) void readFileMetadata(file);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.archiveReadError');
  } finally {
    expandingSelection.value = false;
  }
}
function remove(index: number): void {
  const [removed] = files.value.splice(index, 1);
  if (removed) {
    const entry = metadata.value.find((item) => item.file === removed);
    if (entry) URL.revokeObjectURL(entry.previewUrl);
    metadata.value = metadata.value.filter((item) => item.file !== removed);
  }
}
function metadataFor(file: File): FileMetadata | undefined { return metadata.value.find((item) => item.file === file); }
function uploadProgressFor(file: File): UploadProgress | undefined { return uploadProgress.value[fileFingerprint(file)]; }
function uploadPercent(file: File): number { const progress = uploadProgressFor(file); return progress ? Math.min(100, Math.round((progress.uploadedBytes / Math.max(1, progress.totalBytes)) * 100)) : 0; }
function updateUploadProgress(file: File, progress: UploadProgress): void { uploadProgress.value = { ...uploadProgress.value, [fileFingerprint(file)]: progress }; }
function fileFingerprint(file: File): string { return `${file.name}:${file.size}:${file.lastModified}:${file.type}`; }
function extensionOf(name: string): string { return name.toLowerCase().split('.').pop() ?? ''; }
function isImagePath(name: string): boolean { return new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']).has(extensionOf(name)); }
function isArchiveFile(file: File): boolean { return file.type === 'application/zip' || extensionOf(file.name) === 'zip'; }
function imageType(name: string): string {
  const extension = extensionOf(name);
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'heic' ? 'image/heic' : extension === 'heif' ? 'image/heif' : 'image/jpeg';
}
async function expandPhotoSelection(input: File[]): Promise<{ files: File[]; ignoredFiles: boolean; archiveError: boolean }> {
  const direct = input.filter(isImageFile);
  const archives = input.filter(isArchiveFile);
  const extracted: File[] = [];
  let archiveError = false;
  let ignoredFiles = input.some((file) => !isImageFile(file) && !isArchiveFile(file));
  for (const archive of archives) {
    if (archive.size > 512 * 1024 * 1024) { archiveError = true; continue; }
    try {
      const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
      let extractedBytes = 0;
      for (const [path, bytes] of Object.entries(entries)) {
        const normalized = path.replaceAll('\\', '/');
        if (normalized.startsWith('/') || normalized.split('/').some((part) => part === '..')) { archiveError = true; continue; }
        if (!isImagePath(normalized) || !bytes.byteLength) continue;
        extractedBytes += bytes.byteLength;
        if (extracted.length >= 1000 || extractedBytes > 512 * 1024 * 1024) { archiveError = true; break; }
        const name = normalized.split('/').pop() ?? normalized;
        extracted.push(new File([bytes], name, { type: imageType(name), lastModified: archive.lastModified }));
      }
    } catch {
      archiveError = true;
    }
  }
  if (archives.length && !extracted.length) ignoredFiles = true;
  return { files: [...direct, ...extracted], ignoredFiles, archiveError };
}
function textValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((item) => textValue(item)).filter(Boolean).join(', ') || undefined;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? undefined : value.toLocaleString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  return String(value).trim() || undefined;
}
function captureValue(value: unknown): string | undefined {
  const raw = textValue(value);
  if (!raw) return undefined;
  const match = raw.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return raw;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`);
  return Number.isNaN(date.valueOf()) ? raw : date.toLocaleString();
}
function numericValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}
function exposureValue(value: unknown): string | undefined {
  const number = numericValue(value);
  if (number === undefined) return textValue(value);
  if (number > 0 && number < 1) return `1/${Math.max(1, Math.round(1 / number))}s`;
  return `${number}s`;
}
function numberDisplay(value: unknown): string | undefined {
  const number = numericValue(value);
  if (number === undefined) return undefined;
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, '');
}
function focalLengthValue(value: unknown): string | undefined {
  const formatted = numberDisplay(value);
  return formatted ? `${formatted}mm` : undefined;
}
function apertureValue(value: unknown): string | undefined {
  const formatted = numberDisplay(value);
  return formatted ? `f/${formatted}` : undefined;
}
function isoValue(value: unknown): string | undefined {
  const formatted = numberDisplay(value);
  return formatted ? `ISO ${formatted}` : undefined;
}
function altitudeValue(value: unknown): string | undefined {
  const formatted = numberDisplay(value);
  return formatted ? `${formatted} m` : undefined;
}
function ratingValue(value: unknown): string | undefined {
  const number = numericValue(value);
  return number !== undefined && Number.isInteger(number) && number >= 0 && number <= 7 ? `${number}/7` : undefined;
}
async function imageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Unable to decode image'));
        element.src = url;
      });
      return { width: image.naturalWidth, height: image.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return undefined;
  }
}
async function readFileMetadata(file: File): Promise<void> {
  try {
    const raw = await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: true, translateValues: true, reviveValues: false }) as Record<string, unknown> | undefined;
    const entry = metadata.value.find((item) => item.file === file);
    if (!entry) return;
    if (!raw) { entry.state = 'empty'; return; }
    const camera = [textValue(raw.Make), textValue(raw.Model)].filter(Boolean).join(' ');
    const focalLength = focalLengthValue(raw.FocalLength);
    const aperture = apertureValue(raw.FNumber);
    const shutterSpeed = exposureValue(raw.ExposureTime);
    const iso = isoValue(raw.ISO);
    const exposure = [
      focalLength,
      aperture,
      shutterSpeed,
      iso,
    ].filter(Boolean).join(' · ');
    const latitude = numericValue(raw.latitude);
    const longitude = numericValue(raw.longitude);
    entry.capturedAt = captureValue(raw.DateTimeOriginal ?? raw.CreateDate ?? raw.ModifyDate);
    entry.camera = camera || undefined;
    entry.lens = textValue(raw.LensModel);
    entry.exposure = exposure || undefined;
    entry.focalLength = focalLength;
    entry.aperture = aperture;
    entry.shutterSpeed = shutterSpeed;
    entry.iso = iso;
    entry.gps = latitude === undefined || longitude === undefined ? undefined : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    entry.altitude = altitudeValue(raw.GPSAltitude);
    entry.rating = ratingValue(raw.Rating ?? raw.rating ?? raw['XMP:Rating'] ?? raw['XMP:rating'] ?? raw.xmpRating);
    let width = numericValue(raw.ImageWidth ?? raw.ExifImageWidth);
    let height = numericValue(raw.ImageHeight ?? raw.ExifImageHeight);
    if (width === undefined || height === undefined) {
      const decoded = await imageDimensions(file);
      width = decoded?.width;
      height = decoded?.height;
    }
    entry.dimensions = width === undefined || height === undefined ? undefined : `${Math.round(width)} × ${Math.round(height)}`;
    entry.state = entry.capturedAt || entry.camera || entry.lens || entry.exposure || entry.gps || entry.altitude || entry.rating || entry.dimensions ? 'ready' : 'empty';
  } catch (cause) {
    const entry = metadata.value.find((item) => item.file === file);
    if (entry) { entry.state = 'error'; entry.error = cause instanceof Error ? cause.message : t('admin.metadataError'); }
  }
}
async function loadHistory(): Promise<void> {
  if (!isApiConfigured() || !session.accessToken) return;
  historyLoading.value = true;
  historyError.value = null;
  try {
    history.value = await listImportBatches(workspace.slug, session.accessToken);
  } catch (cause) {
    historyError.value = cause instanceof Error ? cause.message : t('admin.loadHistoryError');
  } finally {
    historyLoading.value = false;
  }
}
function historyLabel(status: ImportBatchSummary['status']): string { return status === 'completed' ? t('admin.statusCompleted') : status === 'failed' ? t('admin.statusFailed') : status === 'cancelled' ? t('admin.statusCancelled') : status === 'queued' ? t('admin.statusQueued') : t('admin.statusProcessing'); }
function statusLabel(status: string): string { return status === 'completed' ? t('admin.statusCompleted') : status === 'failed' ? t('admin.statusFailed') : status === 'cancelled' ? t('admin.statusCancelled') : status === 'queued' ? t('admin.statusQueued') : status === 'processing' ? t('admin.statusProcessing') : status === 'ready' ? t('admin.statusReady') : status; }
function historyTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t('admin.unknownDate') : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
async function openHistory(item: ImportBatchSummary): Promise<void> {
  if (!session.accessToken) return;
  if (selectedHistoryId.value === item.id) {
    selectedHistoryId.value = null;
    historyDetail.value = null;
    return;
  }
  selectedHistoryId.value = item.id;
  historyDetail.value = null;
  historyDetailError.value = null;
  historyDetailLoading.value = true;
  try {
    historyDetail.value = await fetchImportBatch(item.id, session.accessToken, workspace.slug);
  } catch (cause) {
    historyDetailError.value = cause instanceof Error ? cause.message : t('admin.loadImportDetailsError');
  } finally {
    historyDetailLoading.value = false;
  }
}
async function retryHistory(): Promise<void> {
  if (!historyDetail.value || historyDetail.value.status !== 'failed' || !session.accessToken || busy.value) return;
  busy.value = true;
  historyDetailError.value = null;
  try {
    historyDetail.value = await retryImportBatch(historyDetail.value.id, session.accessToken, workspace.slug);
    await loadHistory();
  } catch (cause) {
    historyDetailError.value = cause instanceof Error ? cause.message : t('admin.retryImportError');
  } finally {
    busy.value = false;
  }
}
async function publishHistory(): Promise<void> {
  if (!historyDetail.value || historyDetail.value.counts.completed < 1 || !session.accessToken || publishingHistoryId.value) return;
  publishingHistoryId.value = historyDetail.value.id;
  historyDetailError.value = null;
  try {
    const result = await publishImportBatch(historyDetail.value.id, session.accessToken, workspace.slug);
    historyDetail.value = { ...historyDetail.value, publishedCount: result.publishedCount };
    await loadHistory();
  } catch (cause) {
    historyDetailError.value = cause instanceof Error ? cause.message : t('admin.publishImportError');
  } finally {
    publishingHistoryId.value = null;
  }
}
async function submit(): Promise<void> {
  if (!files.value.length || busy.value) return;
  if (!isApiConfigured()) { error.value = t('admin.apiNotConfigured'); return; }
  if (!session.accessToken) { error.value = t('admin.signInBeforeImport'); return; }
  busy.value = true;
  uploadPaused.value = false;
  uploadAbortController = new AbortController();
  error.value = null;
  const targetWorkspace = workspace.slug;
  batchWorkspaceSlug.value = targetWorkspace;
  try {
    const sourceKeys = await uploadFilesInQueue(targetWorkspace, session.accessToken!, uploadAbortController.signal);
    const createdBatch = await createImportBatch(targetWorkspace, sourceKeys, session.accessToken) as { id: string };
    const preview = await previewImportBatch(createdBatch.id, session.accessToken, targetWorkspace);
    batch.value = preview;
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === 'AbortError')) error.value = cause instanceof Error ? cause.message : t('admin.createImportError');
  } finally {
    busy.value = false;
    uploadAbortController = undefined;
  }
}
function pauseUpload(): void { if (!busy.value || !uploadAbortController) return; uploadPaused.value = true; uploadAbortController.abort(); }
async function uploadFilesInQueue(spaceSlug: string, token: string, signal: AbortSignal): Promise<string[]> {
  const sourceKeys = new Array<string>(files.value.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < files.value.length) {
      const index = cursor++;
      const file = files.value[index];
      sourceKeys[index] = await uploadPhoto(spaceSlug, file, token, { signal, onProgress: (progress) => updateUploadProgress(file, progress) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.value.length) }, () => worker()));
  return sourceKeys;
}
async function retry(): Promise<void> {
  if (!batch.value || busy.value || !session.accessToken) return;
  busy.value = true;
  error.value = null;
  try {
    batch.value = await retryImportBatch(batch.value.id, session.accessToken, batchWorkspaceSlug.value ?? workspace.slug);
    schedulePoll();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.retryImportError');
  } finally {
    busy.value = false;
  }
}
async function confirm(): Promise<void> {
  if (!batch.value || busy.value || !session.accessToken) return;
  busy.value = true;
  error.value = null;
  try {
    batch.value = await confirmImportBatch(batch.value.id, session.accessToken, batchWorkspaceSlug.value ?? workspace.slug);
    schedulePoll();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.confirmImportError');
  } finally {
    busy.value = false;
  }
}
function schedulePoll(): void {
  if (!batch.value || !isQueued.value || !session.accessToken) return;
  pollTimer = setTimeout(async () => {
    if (!batch.value || !session.accessToken) return;
    try {
      batch.value = await fetchImportBatch(batch.value.id, session.accessToken, batchWorkspaceSlug.value ?? workspace.slug);
      if (batch.value.status === 'completed' || batch.value.status === 'failed') void loadHistory();
      schedulePoll();
    } catch (cause) {
      // A memory-backed batch disappears when the API is restarted; let the selected files be submitted again.
      if (cause instanceof Error && cause.message === 'Request failed (404)') {
        batch.value = null;
        batchWorkspaceSlug.value = null;
      }
      error.value = cause instanceof Error ? cause.message : t('admin.refreshImportError');
    }
  }, 1000);
}
onBeforeUnmount(() => { if (pollTimer) clearTimeout(pollTimer); for (const item of metadata.value) URL.revokeObjectURL(item.previewUrl); });
onMounted(loadHistory);
watch(() => workspace.slug, loadHistory);
function isImageFile(file: File): boolean { return new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']).has(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name); }
</script>

<template>
  <section class="admin-view">
    <div class="view-heading"><div><span class="eyebrow">{{ t('admin.importsEyebrow') }}</span><h2>{{ t('admin.importsTitle') }}</h2><p>{{ t('admin.importsDescription') }}</p></div></div>
    <ImportDropzone @files="onFiles" />
    <p v-if="expandingSelection" class="selection-status" role="status"><LoaderCircle :size="14" class="spin" /> {{ t('admin.scanningSelection') }}</p>
    <p v-if="error && !files.length" class="form-error" role="alert">{{ error }}</p>
    <section v-if="files.length" class="preview">
      <div class="preview-heading"><h3>{{ batch ? t('admin.importPreview') : t('admin.readyPreview') }}</h3><span class="muted">{{ t('admin.files', { count: files.length, size: totalSize }) }}</span></div>
      <div v-for="(file, index) in files" :key="`${file.name}-${file.lastModified}-${index}`" class="file-row"><img v-if="metadataFor(file)?.previewUrl" class="preview-thumb" :src="metadataFor(file)?.previewUrl" :alt="file.name" /><FileImage v-else :size="17" /><div class="file-info"><strong>{{ file.name }}</strong><span>{{ (file.size / 1024).toFixed(0) }} KB</span><div v-if="metadataFor(file)?.state === 'reading'" class="metadata-state"><LoaderCircle :size="12" class="spin" /> {{ t('admin.readingMetadata') }}</div><div v-else-if="metadataFor(file)?.state === 'error'" class="metadata-state metadata-error">{{ t('admin.metadataError') }}</div><div v-else-if="metadataFor(file)?.state === 'empty'" class="metadata-state">{{ t('admin.metadataEmpty') }}</div><div v-else-if="metadataFor(file)?.state === 'ready'" class="metadata-grid"><span v-if="metadataFor(file)?.capturedAt"><b>{{ t('admin.metadataDate') }}</b>{{ metadataFor(file)?.capturedAt }}</span><span v-if="metadataFor(file)?.camera"><b>{{ t('admin.metadataCamera') }}</b>{{ metadataFor(file)?.camera }}</span><span v-if="metadataFor(file)?.lens"><b>{{ t('admin.metadataLens') }}</b>{{ metadataFor(file)?.lens }}</span><span v-if="metadataFor(file)?.focalLength"><b>{{ t('admin.metadataFocalLength') }}</b>{{ metadataFor(file)?.focalLength }}</span><span v-if="metadataFor(file)?.aperture"><b>{{ t('admin.metadataAperture') }}</b>{{ metadataFor(file)?.aperture }}</span><span v-if="metadataFor(file)?.shutterSpeed"><b>{{ t('admin.metadataShutterSpeed') }}</b>{{ metadataFor(file)?.shutterSpeed }}</span><span v-if="metadataFor(file)?.iso"><b>{{ t('admin.metadataIso') }}</b>{{ metadataFor(file)?.iso }}</span><span v-if="metadataFor(file)?.gps"><b>{{ t('admin.metadataGps') }}</b>{{ metadataFor(file)?.gps }}</span><span v-if="metadataFor(file)?.altitude"><b>{{ t('admin.metadataAltitude') }}</b>{{ metadataFor(file)?.altitude }}</span><span v-if="metadataFor(file)?.rating"><b>{{ t('admin.metadataRating') }}</b>{{ metadataFor(file)?.rating }}</span><span v-if="metadataFor(file)?.dimensions"><b>{{ t('admin.metadataDimensions') }}</b>{{ metadataFor(file)?.dimensions }}</span></div><div v-if="busy && !batch && uploadProgressFor(file)" class="upload-progress"><div><span>{{ t('admin.uploadingPhoto') }}</span><span>{{ uploadPercent(file) }}%</span></div><progress :value="uploadPercent(file)" max="100" /></div></div><button v-if="!batch" :aria-label="t('admin.removeFile')" @click="remove(index)"><X :size="16" /></button><span v-else class="item-status">{{ statusLabel(batch.items[index]?.status ?? '') }}</span></div>
      <div v-if="batch" class="batch-status"><span>{{ statusLabel(batch.status) }}</span><span>{{ t('admin.processed', { completed: batch.counts.completed, total: batch.counts.total }) }}{{ t('admin.failed', { count: batch.counts.failed }) }}</span></div>
      <div v-if="batch?.status === 'completed'" class="completion-note" role="status"><p>{{ t('admin.importCompleteNotice') }}</p><RouterLink to="/admin/photos">{{ t('admin.goToPhotos') }}</RouterLink></div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div v-if="!batch && busy" class="upload-actions"><button class="confirm-action" type="button" @click="pauseUpload"><Pause :size="16" /> {{ t('admin.pauseUpload') }}</button><span class="progress-action"><LoaderCircle :size="16" class="spin" /> {{ t('admin.importing') }}</span></div><button v-else-if="!batch && uploadPaused" class="confirm-action" type="button" @click="submit"><Play :size="16" /> {{ t('admin.resumeUpload') }}</button><button v-else-if="!batch" class="confirm-action" :disabled="busy" @click="submit"><Check :size="16" /> {{ busy ? t('admin.importing') : t('admin.importPreview') }}</button><button v-else-if="!isQueued && !isFinished" class="confirm-action" :disabled="busy" @click="confirm"><Check :size="16" /> {{ busy ? t('admin.confirming') : t('admin.confirmImport') }}</button><button v-else-if="batch.status === 'failed'" class="confirm-action" :disabled="busy" @click="retry"><Check :size="16" /> {{ busy ? t('admin.retrying') : t('admin.retryFailedItems') }}</button><span v-else-if="isQueued" class="progress-action"><LoaderCircle :size="16" class="spin" /> {{ t('admin.statusProcessing') }}...</span><span v-else class="progress-action">{{ statusLabel(batch.status) }}</span>
    </section>
    <section class="history"><div class="history-heading"><div><span class="eyebrow">{{ t('admin.archiveLog') }}</span><h3>{{ t('admin.importHistory') }}</h3></div><span class="muted">{{ t('admin.historyCount', { count: history.length }) }}</span></div><div v-if="historyLoading" class="history-empty"><LoaderCircle :size="16" class="spin" /> {{ t('admin.loadingHistory') }}</div><p v-else-if="historyError" class="form-error" role="alert">{{ historyError }}</p><div v-else-if="!history.length" class="history-empty">{{ t('admin.noHistory') }}</div><template v-else v-for="item in history" :key="item.id"><button class="history-row" :class="{ selected: selectedHistoryId === item.id }" :aria-expanded="selectedHistoryId === item.id" @click="openHistory(item)"><span><strong>{{ historyLabel(item.status) }}</strong><small>{{ historyTime(item.createdAt) }}</small><small class="history-count">{{ t('admin.photosProcessed', { completed: item.counts.completed, total: item.counts.total }) }}<span v-if="item.counts.failed">{{ t('admin.failedCount', { count: item.counts.failed }) }}</span></small></span></button><div v-if="selectedHistoryId === item.id" class="history-detail"><div v-if="historyDetailLoading" class="history-empty"><LoaderCircle :size="16" class="spin" /> {{ t('admin.loadingDetails') }}</div><p v-else-if="historyDetailError" class="form-error" role="alert">{{ historyDetailError }}</p><template v-else-if="historyDetail"><div class="history-publish-bar"><span v-if="historyAlreadyPublished" class="publish-note" role="status"><Globe2 :size="14" /> {{ t('admin.batchAlreadyPublished') }}</span><button v-else-if="['completed', 'failed'].includes(historyDetail.status) && historyDetail.counts.completed > 0" class="publish-action" :disabled="publishingHistoryId === historyDetail.id" @click.stop="publishHistory"><Send :size="14" /> {{ publishingHistoryId === historyDetail.id ? t('admin.publishing') : t('admin.publishBatch') }}</button><button v-if="historyDetail.status === 'failed'" class="retry-action" :disabled="busy" @click.stop="retryHistory">{{ busy ? t('admin.retrying') : t('admin.retryFailedItems') }}</button></div><div v-for="detail in historyDetail.items" :key="detail.sourceKey" class="detail-row"><div><strong>{{ detail.sourceKey.split('/').pop() }}</strong><small>{{ statusLabel(detail.status) }}</small></div><p v-if="detail.errors.length" class="detail-error">{{ detail.errors.join('; ') }}</p><p v-else-if="detail.warnings.length" class="detail-warning">{{ detail.warnings.join('; ') }}</p><span v-else class="detail-ok">{{ t('admin.ready') }}</span></div></template></div></template></section>
  </section>
</template>

<style scoped>
.admin-view { max-width: 800px; }.view-heading { margin-bottom: 42px; }.view-heading h2 { font-size: 37px; letter-spacing: -.045em; margin: 10px 0 6px; }.view-heading p { color: var(--muted); margin: 0; }.preview { border-top: 1px solid var(--line); margin-top: 34px; padding-top: 24px; }.preview-heading { align-items: baseline; display: flex; justify-content: space-between; }.preview-heading h3 { font-size: 14px; margin: 0; }.preview-heading .muted { font-size: 12px; }.file-row { align-items: flex-start; border-bottom: 1px solid var(--line); display: flex; gap: 12px; padding: 14px 0; }.file-row > svg { color: var(--accent-deep); flex: 0 0 auto; margin-top: 2px; }.file-info { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }.file-row strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.file-row span { color: var(--muted); font-size: 11px; }.metadata-state { align-items: center; color: var(--muted); display: inline-flex; font-size: 11px; gap: 5px; }.metadata-error { color: #a34d4d; }.metadata-grid { display: flex; flex-wrap: wrap; gap: 5px 13px; margin-top: 2px; }.metadata-grid span { color: var(--muted); font-size: 11px; }.metadata-grid b { color: var(--ink); font-weight: 500; margin-right: 4px; }.item-status { color: var(--muted); margin-left: auto; text-transform: capitalize; }.file-row button { align-items: center; background: transparent; color: var(--muted); display: flex; margin-left: auto; padding: 5px; }.file-row button:hover { color: var(--ink); }.batch-status { display: flex; font-size: 12px; justify-content: space-between; margin-top: 16px; text-transform: capitalize; }.progress-action { align-items: center; color: var(--muted); display: inline-flex; font-size: 12px; gap: 7px; margin-top: 19px; }.spin { animation: spin 1s linear infinite; }.confirm-action { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 12px; gap: 7px; margin-top: 19px; padding: 10px 14px; }
.upload-progress { display: grid; gap: 4px; margin-top: 4px; }.upload-progress > div { color: var(--muted); display: flex; font-size: 10px; justify-content: space-between; }.upload-progress progress { accent-color: var(--accent-deep); height: 4px; width: 100%; }
.upload-actions { align-items: center; display: flex; gap: 12px; }
.selection-status { align-items: center; color: var(--muted); display: flex; font-size: 12px; gap: 6px; margin: 12px 0 -15px; }
.preview-thumb { background: var(--surface-soft); border-radius: 3px; flex: 0 0 auto; height: 56px; object-fit: cover; width: 76px; }
.form-error { color: #a34d4d; font-size: 12px; margin: 16px 0 0; }
.completion-note { align-items: baseline; background: var(--surface-soft); border-left: 2px solid var(--accent); display: flex; gap: 14px; justify-content: space-between; margin-top: 17px; padding: 11px 13px; }
.completion-note p { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 0; }
.completion-note a { color: var(--ink); font-size: 12px; font-weight: 550; white-space: nowrap; }
.completion-note a:hover { color: var(--accent-deep); }
.confirm-action:disabled { cursor: wait; opacity: .55; }
.history { border-top: 1px solid var(--line); margin-top: 60px; padding-top: 23px; }.history-heading { align-items: flex-end; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; padding-bottom: 13px; }.history-heading h3 { font-size: 14px; margin: 8px 0 0; }.history-heading .muted { font-size: 12px; }.history-row { align-items: center; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; padding: 15px 0; }.history-row div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }.history-row strong { font-size: 13px; }.history-row span { color: var(--muted); font-size: 11px; }.history-count { white-space: nowrap; }.history-empty { align-items: center; color: var(--muted); display: flex; font-size: 13px; gap: 7px; padding: 22px 0; }
.history-row { background: transparent; border-left: 2px solid transparent; color: inherit; cursor: pointer; text-align: left; width: 100%; }.history-row:hover, .history-row.selected { background: var(--surface-soft); }.history-row.selected { border-left-color: var(--accent); padding-left: 10px; }.history-row > span:first-child { display: grid; gap: 4px; min-width: 0; }.history-row small { color: var(--muted); font-size: 11px; }.history-detail { border-bottom: 1px solid var(--line); padding: 5px 0 17px 18px; }.detail-row { align-items: flex-start; border-bottom: 1px solid var(--line); display: flex; gap: 14px; padding: 12px 0; }.detail-row > div { display: grid; gap: 4px; min-width: 170px; }.detail-row strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.detail-row small { color: var(--muted); font-size: 11px; text-transform: capitalize; }.detail-row p { flex: 1; font-size: 11px; line-height: 1.45; margin: 0; }.detail-error { color: #a34d4d; }.detail-warning { color: #936b29; }.detail-ok { color: #4f7e62; font-size: 11px; margin-left: auto; }.history-actions { display: flex; flex-wrap: wrap; gap: 9px; }.retry-action, .publish-action { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 12px; gap: 6px; margin-top: 15px; padding: 9px 12px; }.publish-action { background: var(--accent-deep); }.retry-action:disabled, .publish-action:disabled { cursor: wait; opacity: .55; }.publish-note { align-items: center; color: #4f7e62; display: flex; font-size: 12px; gap: 6px; margin: 14px 0 0; }
.history-publish-bar { align-items: center; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 9px; justify-content: flex-start; margin-bottom: 2px; padding: 0 0 13px; }.history-publish-bar .publish-action, .history-publish-bar .retry-action { margin-top: 0; }.history-publish-bar .publish-note { margin: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .completion-note { align-items: flex-start; flex-direction: column; gap: 7px; }.history-row { align-items: flex-start; flex-direction: column; gap: 6px; }.history-count { padding-left: 0; }.history-detail { padding-left: 10px; }.detail-row { display: grid; gap: 6px; }.detail-row > div { min-width: 0; }.detail-ok { margin-left: 0; }.history-publish-bar { align-items: flex-start; flex-direction: column; } }
</style>
