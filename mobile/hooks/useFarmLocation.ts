import { useEffect, useState } from "react";
import * as Location from "expo-location";

export type FarmCoords = { lat: number; lon: number } | null;

export function useFarmLocation() {
  const [coords, setCoords] = useState<FarmCoords>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        }
      } catch {
        // District fallback on the API.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
