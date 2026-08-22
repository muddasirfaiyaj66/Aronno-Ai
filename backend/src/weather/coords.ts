import { BANGLADESH_DISTRICTS, DISTRICT_COORDS } from '../lookups/bangladesh-districts';

export type GeoPoint = {
  lat: number;
  lon: number;
  locationBn: string;
};

export { DISTRICT_COORDS };

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
      locationBn: nameBn ?? BANGLADESH_DISTRICTS.find((d) => d.slug === slug)?.nameBn ?? slug,
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
