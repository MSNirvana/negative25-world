import { ApiError } from '@negative25/utils';
import { haversineDistanceKm, orderByDistance, type Coordinate } from './geo.js';

export type LocationRecord = Coordinate & { id: string; parentId: string | null; name: string; alias?: string; photoIds: string[] };
export class LocationService {
  // Locations are created from imported photo metadata or selected in Studio.
  // Keep this service empty by default so demo coordinates never appear in Discover.
  readonly locations: LocationRecord[] = [];
  list(query?: string): LocationRecord[] { const normalized = query?.trim().toLowerCase(); return normalized ? this.locations.filter((location) => location.name.toLowerCase().includes(normalized) || location.alias?.toLowerCase().includes(normalized)) : [...this.locations]; }
  get(id: string): LocationRecord { const location = this.locations.find((item) => item.id === id); if (!location) throw new ApiError('NOT_FOUND', 'Location not found'); return location; }
  nearby(origin: Coordinate, limit = 24): Array<LocationRecord & { distanceKm: number }> { return orderByDistance(origin, this.locations).slice(0, Math.min(100, Math.max(1, limit))); }
  faraway(origin: Coordinate, limit = 24): Array<LocationRecord & { distanceKm: number }> { return orderByDistance(origin, this.locations).reverse().slice(0, Math.min(100, Math.max(1, limit))); }
  photosFor(id: string): string[] { return [...this.get(id).photoIds]; }
}
