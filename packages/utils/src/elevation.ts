export type ElevationCoordinate = { latitude: number; longitude: number };

const defaultElevationEndpoint = 'https://api.open-meteo.com/v1/elevation';

/** Looks up one coordinate and returns metres above sea level when available. */
export async function fetchElevation(coordinate: ElevationCoordinate, endpoint = defaultElevationEndpoint, timeoutMs = 4_000, fetcher: typeof fetch = fetch): Promise<number | undefined> {
  if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(endpoint);
    url.searchParams.set('latitude', String(coordinate.latitude));
    url.searchParams.set('longitude', String(coordinate.longitude));
    const response = await fetcher(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return undefined;
    const body = await response.json() as { elevation?: unknown };
    const value = Array.isArray(body.elevation) ? body.elevation[0] : body.elevation;
    const elevation = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    return Number.isFinite(elevation) ? elevation : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
