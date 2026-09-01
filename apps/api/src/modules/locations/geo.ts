export type Coordinate = { latitude: number; longitude: number };
const earthRadiusKm = 6371.0088;

export function validateCoordinate(coordinate: Coordinate): void {
  if (!Number.isFinite(coordinate.latitude) || coordinate.latitude < -90 || coordinate.latitude > 90) throw new Error('Latitude must be between -90 and 90');
  if (!Number.isFinite(coordinate.longitude) || coordinate.longitude < -180 || coordinate.longitude > 180) throw new Error('Longitude must be between -180 and 180');
}

export function normalizeLongitude(longitude: number): number {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 && longitude > 0 ? 180 : normalized;
}

export function haversineDistanceKm(from: Coordinate, to: Coordinate): number {
  validateCoordinate(from); validateCoordinate(to);
  const lat1 = from.latitude * Math.PI / 180; const lat2 = to.latitude * Math.PI / 180;
  const dLat = lat2 - lat1; const dLon = (normalizeLongitude(to.longitude) - normalizeLongitude(from.longitude)) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function orderByDistance<T extends Coordinate>(origin: Coordinate, points: readonly T[]): Array<T & { distanceKm: number }> {
  return points.map((point) => ({ ...point, distanceKm: haversineDistanceKm(origin, point) })).sort((a, b) => a.distanceKm - b.distanceKm);
}
