import { CHINA_REGION_DEFINITIONS, locationMatchesRegion, normalizeLocationText, regionForLocation, type ChinaRegionDefinition } from '@negative25/contracts';
import type { GalleryPhoto } from '../stores/gallery';

export type LocationOption = {
  id: string;
  group: 'china' | 'other';
  label: string;
  labelEn: string;
  query: string;
  aliases: string[];
  count: number;
  available: boolean;
};

type LocationPhoto = Pick<GalleryPhoto, 'location' | 'locationId'>;

export function buildLocationOptions(photos: readonly LocationPhoto[]): LocationOption[] {
  const china = CHINA_REGION_DEFINITIONS.map((region) => {
    const matches = photos.filter((photo) => photoLocationMatchesRegion(photo, region));
    return regionOption(region, matches.length);
  });

  const otherByKey = new Map<string, { label: string; count: number }>();
  for (const photo of photos) {
    const label = photo.location.trim();
    if (!isUsefulLocation(label) || regionForLocation(label) || isChinaLocation(label)) continue;
    const key = normalizeLocationText(label);
    const current = otherByKey.get(key);
    if (current) current.count += 1;
    else otherByKey.set(key, { label, count: 1 });
  }

  const other = [...otherByKey.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, count }) => ({
      id: slugifyLocation(label),
      group: 'other' as const,
      label,
      labelEn: label,
      query: slugifyLocation(label),
      aliases: [label],
      count,
      available: true,
    }));
  return [...china, ...other];
}

export function photoMatchesLocation(photo: LocationPhoto, locationId: string): boolean {
  const region = CHINA_REGION_DEFINITIONS.find((item) => item.id === locationId);
  if (region) return photoLocationMatchesRegion(photo, region);
  return isUsefulLocation(photo.location) && slugifyLocation(photo.location) === locationId;
}

export function filterPhotosByLocation<T extends LocationPhoto>(photos: readonly T[], locationId: string | null): T[] {
  if (!locationId) return [...photos];
  return photos.filter((photo) => photoMatchesLocation(photo, locationId));
}

export function displayLocationLabel(option: LocationOption, locale: 'zh' | 'en'): string {
  return locale === 'zh' ? option.label : option.labelEn;
}

function regionOption(region: ChinaRegionDefinition, count: number): LocationOption {
  return { id: region.id, group: 'china', label: region.nameZh, labelEn: region.nameEn, query: region.id, aliases: region.aliases, count, available: count > 0 };
}

function photoLocationMatchesRegion(photo: LocationPhoto, region: ChinaRegionDefinition): boolean {
  return isUsefulLocation(photo.location) && (locationMatchesRegion(photo.location, region) || region.aliases.some((alias) => photo.locationId?.toLocaleLowerCase().includes(normalizeLocationText(alias))));
}

function isChinaLocation(value: string): boolean {
  const normalized = normalizeLocationText(value);
  return ['中国', 'china', 'hongkong', 'macao', 'macau', 'taiwan', '臺灣'].includes(normalized);
}

function isUsefulLocation(value: string): boolean {
  if (/^\s*[-+]?\d+(?:\.\d+)?\s*[,，]\s*[-+]?\d+(?:\.\d+)?\s*$/.test(value)) return false;
  const normalized = normalizeLocationText(value);
  return Boolean(normalized) && !['未指定地点', 'unspecifiedlocation', 'unknownlocation'].includes(normalized);
}

function slugifyLocation(value: string): string {
  const slug = value.trim().toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return slug || 'unknown-location';
}
