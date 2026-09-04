import { CHINA_REGION_DEFINITIONS, locationMatchesRegion, normalizeLocationText, overseasRegionForId, overseasRegionForLocation, regionForLocation, type ChinaRegionDefinition, type OverseasRegionDefinition } from '@negative25/contracts';
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

type LocationPhoto = Pick<GalleryPhoto, 'location' | 'locationId' | 'locationName' | 'locationRegion'> & { id?: string };
type OverseasLocationGroup = Pick<OverseasRegionDefinition, 'id' | 'nameZh' | 'nameEn' | 'aliases'>;

export function buildLocationOptions(photos: readonly LocationPhoto[]): LocationOption[] {
  const china = CHINA_REGION_DEFINITIONS.map((region) => {
    const matches = photos.filter((photo) => photoLocationMatchesRegion(photo, region));
    return regionOption(region, matches.length);
  });

  const otherByKey = new Map<string, { id: string; label: string; labelEn: string; aliases: string[]; count: number; seenIds: Set<string> }>();
  for (const [index, photo] of photos.entries()) {
    const label = photo.location.trim();
    if (!isUsefulLocation(label) || regionForLocation(label) || regionForLocation(photo.locationRegion ?? '') || isChinaLocation(label) || isChinaLocation(photo.locationRegion ?? '')) continue;
    const overseasGroup = overseasGroupForPhoto(photo);
    const key = overseasGroup?.id ?? normalizeLocationText(label);
    const optionId = overseasGroup?.id ?? slugifyLocation(label);
    const photoId = photo.id || `photo-index-${index}`;
    const current = otherByKey.get(key);
    if (current) {
      if (!current.seenIds.has(photoId)) current.count += 1;
      current.seenIds.add(photoId);
    } else {
      otherByKey.set(key, { id: optionId, label: overseasGroup?.nameZh ?? label, labelEn: overseasGroup?.nameEn ?? label, aliases: [...(overseasGroup?.aliases ?? [label])], count: 1, seenIds: new Set([photoId]) });
    }
  }

  const other = [...otherByKey.entries()]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([, { id, label, labelEn, aliases, count }]) => ({
      id,
      group: 'other' as const,
      label,
      labelEn,
      query: id,
      aliases,
      count,
      available: true,
    }));
  return [...china, ...other];
}

export function photoMatchesLocation(photo: LocationPhoto, locationId: string): boolean {
  const region = CHINA_REGION_DEFINITIONS.find((item) => item.id === locationId);
  if (region) return photoLocationMatchesRegion(photo, region);
  const overseasRegion = overseasRegionForId(locationId);
  if (overseasRegion) return overseasGroupForPhoto(photo)?.id === overseasRegion.id;
  const overseasGroup = overseasGroupForPhoto(photo);
  if (overseasGroup?.id === locationId) return true;
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
  const candidates = [photo.location, photo.locationName, photo.locationRegion].filter((value): value is string => Boolean(value && isUsefulLocation(value)));
  return candidates.some((value) => locationMatchesRegion(value, region)) || region.aliases.some((alias) => photo.locationId?.toLocaleLowerCase().includes(normalizeLocationText(alias)));
}

function overseasGroupForPhoto(photo: LocationPhoto): OverseasLocationGroup | undefined {
  const explicitRegion = photo.locationRegion?.trim();
  if (explicitRegion && isUsefulLocation(explicitRegion) && !regionForLocation(explicitRegion) && !isChinaLocation(explicitRegion)) {
    return overseasRegionForLocation(explicitRegion) ?? dynamicOverseasGroup(explicitRegion);
  }
  for (const value of [photo.location, photo.locationName ?? '']) {
    if (!isUsefulLocation(value) || regionForLocation(value) || isChinaLocation(value)) continue;
    const knownRegion = overseasRegionForLocation(value);
    if (knownRegion) return knownRegion;
  }
  return undefined;
}

function dynamicOverseasGroup(label: string): OverseasLocationGroup {
  return { id: slugifyLocation(label), nameZh: label, nameEn: label, aliases: [label] };
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
