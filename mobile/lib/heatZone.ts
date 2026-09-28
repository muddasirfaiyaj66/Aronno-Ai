/** Shared size of a disease zone on the heat map. */
export function heatRadiusMeters(caseCount: number) {
  const count = Math.max(1, caseCount);
  return Math.round(Math.min(40_000, 15_000 + 4_000 * Math.sqrt(count)));
}

export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const earth = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function insideHeatZone(
  here: { lat: number; lon: number },
  zone: { lat: number; lon: number },
  caseCount: number,
) {
  return distanceMeters(here, zone) <= heatRadiusMeters(caseCount);
}
