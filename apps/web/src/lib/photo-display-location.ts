export type DisplayLocationInput = {
  standardName?: unknown;
  displayAddress?: unknown;
  displayRegion?: unknown;
  displayRegionEnabled?: unknown;
};

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Normalize provider region labels into a compact prefix for public photo text. */
export function cleanRegionName(value: unknown): string {
  const region = textValue(value);
  if (!region || region === '中国' || region.toLocaleLowerCase() === 'china') return '';
  return region
    .replace(/(?:维吾尔|壮族|回族|藏族)?自治区$/u, '')
    .replace(/(?:特别行政区|省|市|地区)$/u, '')
    .trim();
}

export function formatPhotoDisplayLocation(input: DisplayLocationInput, unspecified = '未指定地点'): string {
  const address = textValue(input.displayAddress);
  const fallback = textValue(input.standardName);
  const location = address || fallback;
  if (!location) return unspecified;

  const region = cleanRegionName(input.displayRegion);
  if (input.displayRegionEnabled !== true || !region) return location;
  if (location === region || location.startsWith(`${region}·`) || location.startsWith(`${region} ·`)) return location;
  return `${region}·${location}`;
}
