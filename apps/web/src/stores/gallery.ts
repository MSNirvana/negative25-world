import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { fetchGallery, fetchPhoto, isApiConfigured } from '../api/client';
import type { PhotoSummary } from '@negative25/contracts';
import { getLocale, t } from '../i18n';
import { filterPhotosByLocation } from '../lib/location-options';
import { formatPhotoDisplayLocation } from '../lib/photo-display-location';

export type GalleryMode = 'featured' | 'recent' | 'shuffle' | 'location' | 'nearby' | 'faraway';
export type PhotoCoordinates = { latitude: number; longitude: number };
export type GalleryPhoto = {
  id: string;
  title: string;
  caption: string;
  capturedAt: string;
  location: string;
  aspectRatio: number;
  image: string;
  fullImage: string;
  tone: string;
  /** Keep raw location metadata separate from the formatted display label. */
  locationName?: string;
  locationRegion?: string;
  camera: string;
  lens: string;
  focalLength: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
  rating: number | null;
  locationId?: string;
  coordinates?: PhotoCoordinates;
  altitude?: number;
};

const demoPhotos: GalleryPhoto[] = [
  { id: 'alpine-light', title: 'Alpine light', caption: 'Quiet light across the high country', capturedAt: '12 Oct 2025', location: 'Dolomites, Italy', aspectRatio: 1.5, image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=88', fullImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=92', tone: '#bdc9d0', camera: 'Leica Q3', lens: '28mm Summilux', focalLength: '28mm', aperture: 'f/1.7', shutterSpeed: '1/500s', iso: 'ISO 100', rating: 6 },
  { id: 'after-rain', title: 'After rain', caption: 'A short pause on the forest trail', capturedAt: '08 Sep 2025', location: 'Hokkaido, Japan', aspectRatio: 0.78, image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=88', fullImage: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=92', tone: '#b5c1ba', camera: 'Fujifilm GFX 100S', lens: '45mm f/2.8', focalLength: '45mm', aperture: 'f/2.8', shutterSpeed: '1/250s', iso: 'ISO 400', rating: 5 },
  { id: 'first-tide', title: 'First tide', caption: 'The shore before the town wakes', capturedAt: '21 Aug 2025', location: 'Cornwall, UK', aspectRatio: 1.33, image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=88', fullImage: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=2400&q=92', tone: '#c7d7dc', camera: 'Sony A7R V', lens: '24mm f/1.4 GM', focalLength: '24mm', aperture: 'f/1.4', shutterSpeed: '1/640s', iso: 'ISO 100', rating: 7 },
  { id: 'blue-hour', title: 'Blue hour', caption: 'Last color on the ridge', capturedAt: '19 Jul 2025', location: 'Banff, Canada', aspectRatio: 1.5, image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=88', fullImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2400&q=92', tone: '#b4c0cf', camera: 'Nikon Z8', lens: '50mm f/1.8 S', focalLength: '50mm', aperture: 'f/1.8', shutterSpeed: '1/320s', iso: 'ISO 200', rating: 4 },
  { id: 'open-road', title: 'Open road', caption: 'A line through the western desert', capturedAt: '02 Jun 2025', location: 'Utah, USA', aspectRatio: 1.1, image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=88', fullImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=92', tone: '#d4c5b1', camera: 'Leica M11', lens: '35mm Summicron', focalLength: '35mm', aperture: 'f/2', shutterSpeed: '1/125s', iso: 'ISO 200', rating: 3 },
  { id: 'low-cloud', title: 'Low cloud', caption: 'Weather moving over the valley', capturedAt: '16 May 2025', location: 'Tasmania, Australia', aspectRatio: 0.82, image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=88', fullImage: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=2400&q=92', tone: '#bec6bf', camera: 'Canon R5', lens: '70-200mm f/2.8', focalLength: '135mm', aperture: 'f/2.8', shutterSpeed: '1/800s', iso: 'ISO 100', rating: 0 },
];

export const useGalleryStore = defineStore('gallery', () => {
  const mode = ref<GalleryMode>('featured');
  const selectedLocation = ref<string | null>(null);
  const photos = ref<GalleryPhoto[]>(demoPhotos);
  const locationPhotos = ref<GalleryPhoto[]>(isApiConfigured() ? [] : demoPhotos);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const nextCursor = ref<string | null>(null);
  const nextCursorMode = ref<GalleryMode | null>(null);
  const activePhoto = ref<GalleryPhoto | null>(null);
  const spaceSlug = ref('primary');
  const authToken = ref<string | null>(null);
  const shuffleSeed = ref(nextShuffleSeed());
  let activeRequest: AbortController | null = null;
  let requestSequence = 0;
  const visiblePhotos = computed(() => {
    let result = [...photos.value];
    if (!isApiConfigured()) {
      result = sortGalleryPhotosForMode(result, mode.value, shuffleSeed.value);
    }
    if (mode.value === 'location' && selectedLocation.value) result = filterPhotosByLocation(result, selectedLocation.value);
    return result;
  });
  function setMode(next: GalleryMode): void {
    const modeChanged = mode.value !== next;
    const refreshShuffle = next === 'shuffle' && !modeChanged;
    mode.value = next;
    if (next === 'shuffle' && (modeChanged || refreshShuffle)) shuffleSeed.value = nextShuffleSeed();
    if (modeChanged || refreshShuffle) {
      nextCursor.value = null;
      nextCursorMode.value = null;
    }
  }
  function setLocation(next: string | null): void { selectedLocation.value = next; }
  function setContext(nextSpaceSlug: string, token: string | null): void {
    if (spaceSlug.value === nextSpaceSlug && authToken.value === token) return;
    activeRequest?.abort();
    requestSequence += 1;
    spaceSlug.value = nextSpaceSlug;
    authToken.value = token;
    photos.value = isApiConfigured() ? [] : demoPhotos;
    locationPhotos.value = isApiConfigured() ? [] : demoPhotos;
    nextCursor.value = null;
    nextCursorMode.value = null;
    activePhoto.value = null;
  }
  function openPhoto(photo: GalleryPhoto): void { activePhoto.value = photo; }
  function closePhoto(): void { activePhoto.value = null; }
  function previousPhoto(): GalleryPhoto | null { const list = visiblePhotos.value; const index = list.findIndex((item) => item.id === activePhoto.value?.id); const next = index > 0 ? list[index - 1] : null; if (next) activePhoto.value = next; return next; }
  function nextPhoto(): GalleryPhoto | null { const list = visiblePhotos.value; const index = list.findIndex((item) => item.id === activePhoto.value?.id); const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null; if (next) activePhoto.value = next; return next; }
  async function load(nextMode = mode.value, append = false): Promise<void> {
    if (!isApiConfigured()) return;
    activeRequest?.abort();
    const controller = new AbortController();
    const requestId = ++requestSequence;
    const requestSpaceSlug = spaceSlug.value;
    const requestToken = authToken.value;
    const requestSeed = nextMode === 'shuffle' ? shuffleSeed.value : undefined;
    const requestCursor = append && nextMode === mode.value && nextCursorMode.value === nextMode ? nextCursor.value ?? undefined : undefined;
    activeRequest = controller;
    loading.value = true;
    error.value = null;
    try {
      if (nextMode === 'location' && selectedLocation.value && !locationPhotos.value.length) {
        const catalog = await fetchGallery('featured', undefined, controller.signal, undefined, spaceSlug.value, authToken.value, 100);
        if (controller.signal.aborted) return;
        locationPhotos.value = catalog.photos.map(toGalleryPhoto);
      }
      const response = await fetchGallery(nextMode, requestCursor, controller.signal, nextMode === 'location' ? selectedLocation.value ?? undefined : undefined, requestSpaceSlug, requestToken, undefined, requestSeed);
      if (controller.signal.aborted || requestId !== requestSequence || mode.value !== nextMode || spaceSlug.value !== requestSpaceSlug || authToken.value !== requestToken || (nextMode === 'shuffle' && shuffleSeed.value !== requestSeed)) return;
      const incoming = response.photos.map(toGalleryPhoto);
      const mergedPhotos = append ? [...photos.value, ...incoming.filter((photo) => !photos.value.some((existing) => existing.id === photo.id))] : incoming;
      photos.value = mergedPhotos;
      if (nextMode !== 'location' || !selectedLocation.value) {
        locationPhotos.value = append ? [...locationPhotos.value, ...incoming.filter((photo) => !locationPhotos.value.some((existing) => existing.id === photo.id))] : incoming;
      }
      nextCursor.value = response.pagination.nextCursor;
      nextCursorMode.value = nextMode;
    } catch (cause) {
      if (controller.signal.aborted) return;
      error.value = cause instanceof Error ? cause.message : t('gallery.loadError');
    } finally {
      if (activeRequest === controller) {
        activeRequest = null;
        loading.value = false;
      }
    }
  }
  async function loadPhoto(id: string): Promise<GalleryPhoto | null> {
    if (!isApiConfigured()) return null;
    loading.value = true;
    error.value = null;
    try {
      const result = toGalleryPhoto(await fetchPhoto(id, undefined, spaceSlug.value, authToken.value));
      if (!photos.value.some((photo) => photo.id === result.id)) photos.value.push(result);
      return result;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('photo.loadError');
      return null;
    } finally {
      loading.value = false;
    }
  }
  return { mode, selectedLocation, photos, locationPhotos, visiblePhotos, loading, error, nextCursor, activePhoto, spaceSlug, shuffleSeed, setMode, setLocation, setContext, openPhoto, closePhoto, previousPhoto, nextPhoto, load, loadPhoto };
});

export function toGalleryPhoto(photo: PhotoSummary): GalleryPhoto {
  const metadata = photo.metadata as Record<string, unknown>;
  const coordinates = coordinatesFrom(metadata);
  const standardName = photo.location?.name ?? (coordinates ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}` : undefined);
  const locationName = photo.location?.name ?? stringValue(metadata.locationName);
  const locationRegion = stringValue(metadata.displayRegion);
  return {
    id: photo.id,
    title: photo.title,
    caption: photo.description ?? '',
    capturedAt: formatDate(photo.capturedAt),
    location: formatPhotoDisplayLocation({
      standardName,
      displayAddress: metadata.displayAddress,
      displayRegion: metadata.displayRegion,
      displayRegionEnabled: metadata.displayRegionEnabled,
    }, t('photo.unspecifiedLocation')),
    aspectRatio: photo.aspectRatio,
    image: photo.thumbnail.url,
    fullImage: photo.media.find((media) => media.kind === 'large')?.url ?? photo.media.find((media) => media.kind === 'preview')?.url ?? photo.thumbnail.url,
    tone: toneFor(photo.id),
    locationName: locationName || undefined,
    locationRegion: locationRegion || undefined,
    camera: cameraField(metadata),
    lens: textField(metadata.lens),
    focalLength: formatFocalLength(metadata.focalLength),
    aperture: formatAperture(metadata.aperture),
    shutterSpeed: formatShutterSpeed(metadata.shutterSpeed),
    iso: formatIso(metadata.iso),
    rating: ratingFrom(photo.rating ?? metadata.rating),
    locationId: photo.location?.id,
    coordinates,
    altitude: numberFrom(metadata.altitude),
  };
}

export function sortGalleryPhotosForMode<T extends Pick<GalleryPhoto, 'id' | 'title' | 'rating' | 'aspectRatio' | 'capturedAt'>>(
  photos: readonly T[],
  mode: GalleryMode,
  shuffleSeed = 0,
): T[] {
  const result = [...photos];
  if (mode === 'featured') return result.sort(compareFeaturedPhotos);
  if (mode === 'recent') return result.sort(compareRecentPhotos);
  if (mode === 'shuffle') return result.sort((left, right) => shuffleRank(left.id, shuffleSeed) - shuffleRank(right.id, shuffleSeed) || left.id.localeCompare(right.id));
  return result;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function coordinatesFrom(metadata: Record<string, unknown>): PhotoCoordinates | undefined {
  const latitude = typeof metadata.latitude === 'number' ? metadata.latitude : typeof metadata.latitude === 'string' ? Number(metadata.latitude) : NaN;
  const longitude = typeof metadata.longitude === 'number' ? metadata.longitude : typeof metadata.longitude === 'string' ? Number(metadata.longitude) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined;
  return { latitude, longitude };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(getLocale() === 'zh' ? 'zh-CN' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function textField(value: unknown): string { return typeof value === 'string' && value.trim() ? value : t('photo.notRecorded'); }

function numberFrom(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function displayNumber(value: unknown): string | undefined {
  const number = numberFrom(value);
  if (number === undefined) return undefined;
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, '');
}

function cameraField(metadata: Record<string, unknown>): string {
  const make = typeof metadata.cameraMake === 'string' && metadata.cameraMake.trim() ? compactCameraMake(metadata.cameraMake) : undefined;
  const model = typeof metadata.cameraModel === 'string' && metadata.cameraModel.trim() ? compactCameraName(metadata.cameraModel) : undefined;
  if (model) {
    if (!make || model.toLocaleLowerCase().startsWith(make.toLocaleLowerCase())) return model;
    return `${make} ${model}`;
  }
  const camera = typeof metadata.camera === 'string' && metadata.camera.trim() ? compactCameraName(metadata.camera) : undefined;
  if (camera && make && camera.toLocaleLowerCase().startsWith(make.toLocaleLowerCase())) return camera.slice(make.length).trim() || camera;
  return textField(camera ?? [make, model].filter(Boolean).join(' '));
}

function compactCameraName(value: string): string {
  return value.trim().replace(/^(?:NIKON CORPORATION|CANON INC\.|SONY CORPORATION|FUJIFILM CORPORATION|LEICA CAMERA AG|RICOH IMAGING COMPANY, LTD\.)\s+/i, '').trim();
}

function compactCameraMake(value: string): string {
  return value.trim().replace(/\s+(?:corporation|corp\.?|inc\.?|company|ag|ltd\.?)$/i, '').trim();
}

function formatFocalLength(value: unknown): string {
  const formatted = displayNumber(value);
  return formatted ? `${formatted}mm` : t('photo.notRecorded');
}

function formatAperture(value: unknown): string {
  const formatted = displayNumber(value);
  return formatted ? `f/${formatted}` : t('photo.notRecorded');
}

function formatShutterSpeed(value: unknown): string {
  const number = numberFrom(value);
  if (number === undefined) return textField(value);
  if (number > 0 && number < 1) return `1/${Math.max(1, Math.round(1 / number))}s`;
  return `${displayNumber(number)}s`;
}

function formatIso(value: unknown): string {
  const formatted = displayNumber(value);
  return formatted ? `ISO ${formatted}` : t('photo.notRecorded');
}

function ratingFrom(value: unknown): number | null {
  const rating = numberFrom(value);
  return rating !== undefined && Number.isInteger(rating) && rating >= 0 && rating <= 7 ? rating : null;
}

function toneFor(id: string): string {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 16% 78%)`;
}

type SortableGalleryPhoto = Pick<GalleryPhoto, 'id' | 'title' | 'rating' | 'aspectRatio' | 'capturedAt'>;

function compareFeaturedPhotos(left: SortableGalleryPhoto, right: SortableGalleryPhoto): number {
  const ratingDifference = (right.rating ?? -1) - (left.rating ?? -1);
  if (ratingDifference) return ratingDifference;
  // Keep matching frame shapes together so justified rows look calmer within a rating.
  const ratioDifference = right.aspectRatio - left.aspectRatio;
  if (ratioDifference) return ratioDifference;
  return left.title.localeCompare(right.title);
}

function compareRecentPhotos(left: SortableGalleryPhoto, right: SortableGalleryPhoto): number {
  const leftTime = Date.parse(left.capturedAt);
  const rightTime = Date.parse(right.capturedAt);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
  if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) return Number.isFinite(rightTime) ? 1 : -1;
  return right.capturedAt.localeCompare(left.capturedAt) || left.id.localeCompare(right.id);
}

function nextShuffleSeed(): number { return Math.floor(Math.random() * 0xFFFFFFFF); }

function shuffleRank(value: string, seed: number): number {
  let hash = seed ^ 0x811C9DC5;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193);
  return hash >>> 0;
}
