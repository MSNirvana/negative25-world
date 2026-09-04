import { regionForLocation } from '@negative25/contracts';
import type { GalleryPhoto, PhotoCoordinates } from '../stores/gallery';

export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 620;

export type DiscoverGroupId = 'featured' | 'recent' | 'asia' | 'europe' | 'americas' | 'britain' | 'small-town' | 'unlocated';
export type DiscoverGroup = { id: DiscoverGroupId; label: string };
export const DISCOVER_GROUPS: DiscoverGroup[] = [
  { id: 'featured', label: '精选' },
  { id: 'recent', label: '近期更新' },
  { id: 'europe', label: '欧洲都市' },
  { id: 'americas', label: '美洲魅力' },
  { id: 'britain', label: '英伦风情' },
  { id: 'small-town', label: '小城故事' },
  { id: 'unlocated', label: '未定位照片' },
];

export type DiscoverLocation = {
  id: string;
  slug: string;
  name: string;
  coordinates: PhotoCoordinates;
  photoIds: string[];
  photos: GalleryPhoto[];
  coverPhoto?: GalleryPhoto;
  group: DiscoverGroupId;
};

export function isValidCoordinates(value: Partial<PhotoCoordinates> | null | undefined): value is PhotoCoordinates {
  if (!value) return false;
  const latitude = value.latitude;
  const longitude = value.longitude;
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function projectCoordinates(coordinates: PhotoCoordinates, width = WORLD_WIDTH, height = WORLD_HEIGHT): { x: number; y: number } {
  if (!isValidCoordinates(coordinates)) throw new Error('Invalid coordinates');
  return { x: ((coordinates.longitude + 180) / 360) * width, y: ((90 - coordinates.latitude) / 180) * height };
}

const EARTH_AXIS = 6378245;
const ECCENTRICITY = 0.006693421622965943;

function outOfChina(latitude: number, longitude: number): boolean {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLatitude(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return ret;
}

function transformLongitude(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return ret;
}

/** Convert photo EXIF WGS84 to the GCJ-02 coordinates used by AMap in mainland China. */
export function toAMapCoordinates(coordinates: PhotoCoordinates): [number, number] {
  const { latitude, longitude } = coordinates;
  if (outOfChina(latitude, longitude)) return [longitude, latitude];
  const dLat = transformLatitude(longitude - 105, latitude - 35);
  const dLon = transformLongitude(longitude - 105, latitude - 35);
  const radLat = latitude / 180 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ECCENTRICITY * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const mgLat = latitude + (dLat * 180) / ((EARTH_AXIS * (1 - ECCENTRICITY)) / (magic * sqrtMagic) * Math.PI);
  const mgLon = longitude + (dLon * 180) / (EARTH_AXIS / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [mgLon, mgLat];
}

/** Convert a point selected in AMap (GCJ-02) back to WGS84 for storage. */
export function fromAMapCoordinates(value: [number, number]): PhotoCoordinates {
  const [longitude, latitude] = value;
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  let guess: PhotoCoordinates = { latitude, longitude };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const [mappedLongitude, mappedLatitude] = toAMapCoordinates(guess);
    guess = {
      latitude: guess.latitude + latitude - mappedLatitude,
      longitude: guess.longitude + longitude - mappedLongitude,
    };
  }
  return guess;
}

export function slugForLocation(name: string, id?: string): string {
  const source = (id || name).trim().toLowerCase();
  const slug = source.normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug) return slug;
  let hash = 0;
  for (const character of source) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return `place-${hash.toString(36)}`;
}

export function groupForLocation(name: string, coordinates: PhotoCoordinates): Exclude<DiscoverGroupId, 'featured' | 'recent' | 'unlocated'> {
  const value = name.toLowerCase();
  if (/uk|britain|england|scotland|wales|cornwall|london|liverpool|brighton/.test(value)) return 'britain';
  if (coordinates.longitude >= 25 && coordinates.longitude <= 55 && coordinates.latitude >= 35 && coordinates.latitude <= 72) return 'europe';
  if (coordinates.longitude >= 60 || (coordinates.longitude >= 25 && coordinates.latitude < 35)) return 'asia';
  if (coordinates.longitude < -20) return 'americas';
  if (coordinates.latitude < 0 && coordinates.longitude > 95) return 'small-town';
  return 'small-town';
}

export type LocationInput = { id?: string; name: string; latitude: number | null; longitude: number | null; photoIds?: string[] };

export function normalizeLocations(inputs: LocationInput[], photos: GalleryPhoto[]): DiscoverLocation[] {
  const byKey = new Map<string, DiscoverLocation>();
  for (const input of inputs) {
    const latitude = input.latitude ?? NaN;
    const longitude = input.longitude ?? NaN;
    if (!isValidCoordinates({ latitude, longitude })) continue;
    const id = input.id || slugForLocation(input.name);
    const key = id || input.name.trim().toLowerCase();
    const existingPhotos = photos.filter((photo) => input.photoIds?.includes(photo.id) || photo.locationId === input.id || (photo.location === input.name && photo.coordinates));
    const coordinates = { latitude, longitude };
    const location: DiscoverLocation = {
      id, slug: slugForLocation(input.name, id), name: input.name, coordinates, photoIds: [...new Set([...(input.photoIds || []), ...existingPhotos.map((photo) => photo.id)])], photos: existingPhotos,
      coverPhoto: existingPhotos[0], group: groupForLocation(input.name, coordinates),
    };
    const previous = byKey.get(key);
    if (previous) {
      previous.photoIds = [...new Set([...previous.photoIds, ...location.photoIds])];
      previous.photos = [...new Map([...previous.photos, ...location.photos].map((photo) => [photo.id, photo])).values()];
      previous.coverPhoto ||= location.coverPhoto;
    } else byKey.set(key, location);
  }
  for (const photo of photos) {
    if (!photo.coordinates) continue;
    const hasLocationName = photo.location.trim() && photo.location.toLowerCase() !== 'unspecified location';
    const displayName = hasLocationName ? photo.location : `${photo.coordinates.latitude.toFixed(2)}, ${photo.coordinates.longitude.toFixed(2)}`;
    const key = photo.locationId || displayName.trim().toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.photos.some((item) => item.id === photo.id)) existing.photos.push(photo);
      if (!existing.photoIds.includes(photo.id)) existing.photoIds.push(photo.id);
      existing.coverPhoto ||= photo;
      continue;
    }
    const id = photo.locationId || slugForLocation(displayName);
    byKey.set(key, { id, slug: slugForLocation(displayName, id), name: displayName, coordinates: photo.coordinates, photoIds: [photo.id], photos: [photo], coverPhoto: photo, group: groupForLocation(displayName, photo.coordinates) });
  }
  return [...byKey.values()];
}

export function filterLocations(locations: DiscoverLocation[], query: string): DiscoverLocation[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return locations;
  return locations.filter((location) => {
    const photoText = location.photos.map((photo) => [photo.title, photo.caption, photo.location, photo.locationName, photo.locationRegion, photo.locationId].filter(Boolean).join(' ')).join(' ');
    return `${location.name} ${location.slug} ${photoText}`.toLowerCase().includes(normalized);
  });
}

export type LocationCluster = { id: string; x: number; y: number; count: number; locations: DiscoverLocation[] };
export function clusterLocations(locations: DiscoverLocation[], zoom: number): Array<{ location: DiscoverLocation; x: number; y: number } | LocationCluster> {
  const threshold = Math.max(9, 26 / Math.max(1, zoom));
  const clusters: LocationCluster[] = [];
  for (const location of locations) {
    const point = projectCoordinates(location.coordinates);
    const cluster = clusters.find((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= threshold);
    if (cluster) {
      cluster.locations.push(location); cluster.count += 1;
      cluster.x = cluster.locations.reduce((sum, item) => sum + projectCoordinates(item.coordinates).x, 0) / cluster.locations.length;
      cluster.y = cluster.locations.reduce((sum, item) => sum + projectCoordinates(item.coordinates).y, 0) / cluster.locations.length;
    } else clusters.push({ id: `cluster-${clusters.length}`, x: point.x, y: point.y, count: 1, locations: [location] });
  }
  return clusters.map((cluster) => cluster.count === 1 && cluster.locations[0] ? { location: cluster.locations[0], x: cluster.x, y: cluster.y } : cluster);
}

export type ContainerPoint = { x: number; y: number };
export type CirclePhotoGroup = { key: string; label: string; kind: 'province' | 'country' | 'unclassified' };
export type CirclePhotoSection = CirclePhotoGroup & { photos: GalleryPhoto[] };

/** Returns true when a screen/container point falls inside a fixed pixel circle. */
export function pointInCircle(point: ContainerPoint, center: ContainerPoint, radius: number): boolean {
  if (!Number.isFinite(radius) || radius < 0) return false;
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius;
}

/** Collects unique photos belonging to locations whose map points are inside the circle. */
export function photosInCircle(locations: DiscoverLocation[], pointForLocation: (location: DiscoverLocation) => ContainerPoint | undefined, center: ContainerPoint, radius: number): GalleryPhoto[] {
  const selected = new Map<string, GalleryPhoto>();
  for (const location of locations) {
    const point = pointForLocation(location);
    if (!point || !pointInCircle(point, center, radius)) continue;
    for (const photo of location.photos) selected.set(photo.id, photo);
  }
  return [...selected.values()];
}

/** Groups selected photos into province headings, then overseas country/region headings. */
export function groupPhotosByRegion(photos: readonly GalleryPhoto[], locale: 'zh' | 'en' = 'zh', resolved = new Map<string, CirclePhotoGroup>()): CirclePhotoSection[] {
  const groups = new Map<string, CirclePhotoSection>();
  for (const photo of photos) {
    const classification = resolved.get(photo.id) ?? groupForLocationName(photo.location, locale);
    const section = groups.get(classification.key) ?? { ...classification, photos: [] };
    section.photos.push(photo);
    groups.set(classification.key, section);
  }
  return [...groups.values()].sort((a, b) => {
    const rank = (section: CirclePhotoSection): number => section.kind === 'province' ? 0 : section.kind === 'country' ? 1 : 2;
    return (rank(a) - rank(b)) || a.label.localeCompare(b.label, locale === 'zh' ? 'zh-CN' : 'en-US');
  });
}

export function groupForLocationName(value: string, locale: 'zh' | 'en' = 'zh'): CirclePhotoGroup {
  const region = regionForLocation(value);
  if (region) return { key: region.id, label: locale === 'zh' ? region.nameZh : region.nameEn, kind: 'province' };
  const key = countryKeyForLocation(value);
  return { key, label: countryLabelForLocation(value, locale), kind: key === 'unclassified' ? 'unclassified' : 'country' };
}

export function groupForAddressParts(province: string | undefined, country: string | undefined, locale: 'zh' | 'en' = 'zh'): CirclePhotoGroup {
  if (province) {
    const region = regionForLocation(province);
    if (region) return { key: region.id, label: locale === 'zh' ? region.nameZh : region.nameEn, kind: 'province' };
  }
  const value = country?.trim() || '';
  if (value) return { key: countryKeyForLocation(value), label: value, kind: 'country' };
  return { key: 'unclassified', label: locale === 'zh' ? '未分类' : 'Unclassified', kind: 'unclassified' };
}

function countryKeyForLocation(value: string): string {
  return normalizeCountryPart(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') || 'unclassified';
}

function countryLabelForLocation(value: string, locale: 'zh' | 'en'): string {
  const part = normalizeCountryPart(value);
  if (part) return part;
  return locale === 'zh' ? '未分类' : 'Unclassified';
}

function normalizeCountryPart(value: string): string {
  const parts = value.split(/[，,、/|·]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts.at(-1) ?? '';
  const trimmed = value.trim();
  if (!trimmed || /^[-+]?\d+(?:\.\d+)?\s*[,，]\s*[-+]?\d+(?:\.\d+)?$/.test(trimmed)) return '';
  if (/^(?:unspecified|unknown|未指定|未知)/i.test(trimmed)) return '';
  return trimmed;
}
