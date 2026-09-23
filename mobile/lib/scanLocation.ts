import * as Location from "expo-location";

/**
 * Best-effort GPS fix for tagging a diagnosis with where it was scanned (feeds
 * the market heat map). Never prompts: uses the last known position only when
 * permission was already granted. The server falls back to the profile
 * district when this returns nothing.
 */
export async function scanLocation(): Promise<{ lat: number; lon: number } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 });
    if (!pos) return null;
    const { latitude: lat, longitude: lon } = pos.coords;
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
}
