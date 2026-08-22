import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";

export type FarmCoords = { lat: number; lon: number };

export type FarmLocationStatus = "loading" | "granted" | "denied" | "off";

export type FarmLocation = {
  coords: FarmCoords | null;
  labelBn: string | null;
  status: FarmLocationStatus;
  refresh: (
    openSettings?: boolean,
  ) => Promise<{ coords: FarmCoords; labelBn: string | null } | null>;
};

function toCoords(pos: Location.LocationObject | null | undefined): FarmCoords | null {
  if (!pos) return null;
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function labelFromAddress(addr?: Location.LocationGeocodedAddress | null): string | null {
  if (!addr) return null;
  const parts = [addr.district, addr.city, addr.subregion, addr.region, addr.name]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && part.length > 1);
  return parts[0] ?? null;
}

async function readPosition(): Promise<FarmCoords | null> {
  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // User left high-accuracy off — still try last known / GPS.
    }
  }

  const last = await Location.getLastKnownPositionAsync({
    maxAge: 20 * 60_000,
  });
  const lastCoords = toCoords(last);

  try {
    const current = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 12_000);
      }),
    ]);
    return toCoords(current) ?? lastCoords;
  } catch {
    return lastCoords;
  }
}

async function placeLabel(coords: FarmCoords): Promise<string | null> {
  if (Platform.OS === "web") return "আপনার অবস্থান";
  try {
    const hits = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lon,
    });
    return labelFromAddress(hits[0]) ?? "আপনার অবস্থান";
  } catch {
    return "আপনার অবস্থান";
  }
}

export function matchDistrictSlug(
  label: string | null,
  districts: { slug: string; nameBn: string }[],
): string | null {
  if (!label) return null;
  const hay = label.toLowerCase();
  const aliases: Record<string, string[]> = {
    jashore: ["যশোর", "jessore", "jashore"],
    munshiganj: ["মুন্সিগঞ্জ", "munshiganj"],
    bogura: ["বগুড়া", "bogra", "bogura"],
    rangpur: ["রংপুর", "rangpur"],
    comilla: ["কুমিল্লা", "comilla", "cumilla"],
  };
  for (const row of districts) {
    const keys = aliases[row.slug] ?? [row.nameBn, row.slug];
    if (keys.some((key) => hay.includes(key.toLowerCase()) || label.includes(key))) {
      return row.slug;
    }
  }
  return null;
}

export function useFarmLocation(): FarmLocation {
  const [coords, setCoords] = useState<FarmCoords | null>(null);
  const [labelBn, setLabelBn] = useState<string | null>(null);
  const [status, setStatus] = useState<FarmLocationStatus>("loading");

  const refresh = useCallback(async (openSettings = false) => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setStatus("off");
        if (openSettings) await Linking.openSettings();
        return null;
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        } else if (openSettings) {
          await Linking.openSettings();
          return null;
        }
        if (permission.status !== "granted") {
          setStatus("denied");
          return null;
        }
      }

      const next = await readPosition();
      if (!next) {
        setStatus("granted");
        return null;
      }
      const label = await placeLabel(next);
      setCoords(next);
      setLabelBn(label);
      setStatus("granted");
      return { coords: next, labelBn: label };
    } catch {
      setStatus("off");
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { coords, labelBn, status, refresh };
}
