export type GeoPoint = {
  lat: number;
  lon: number;
  locationBn: string;
};

/** Approximate district seats used when GPS is unavailable. */
export const DISTRICT_COORDS: Record<string, { lat: number; lon: number }> = {
  jashore: { lat: 23.1667, lon: 89.2167 },
  munshiganj: { lat: 23.5422, lon: 90.5305 },
  bogura: { lat: 24.8465, lon: 89.377 },
  rangpur: { lat: 25.7439, lon: 89.2752 },
  comilla: { lat: 23.4607, lon: 91.1809 },
};

export const DEFAULT_POINT: GeoPoint = {
  lat: DISTRICT_COORDS.jashore.lat,
  lon: DISTRICT_COORDS.jashore.lon,
  locationBn: 'যশোর',
};

export function pointFromDistrict(
  slug?: string | null,
  nameBn?: string | null,
): GeoPoint {
  if (slug && DISTRICT_COORDS[slug]) {
    return {
      ...DISTRICT_COORDS[slug],
      locationBn: nameBn ?? slug,
    };
  }
  return { ...DEFAULT_POINT, locationBn: nameBn ?? DEFAULT_POINT.locationBn };
}

export function parseLatLon(
  latRaw?: string | number,
  lonRaw?: string | number,
): { lat: number; lon: number } | null {
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  const lon = typeof lonRaw === 'number' ? lonRaw : Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
