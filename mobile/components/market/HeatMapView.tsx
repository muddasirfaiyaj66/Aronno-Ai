import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import type { HeatmapArea } from "@/types/market";
import { HEAT_COLORS } from "./heatmapHtml";
import { heatRadiusMeters } from "@/lib/heatZone";

export type HeatMapViewProps = {
  areas: HeatmapArea[];
  onSelect: (slug: string) => void;
  height?: number;
  /** Parent scroll should pause so the map can pan. */
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
};

const TILE = 256;
const MIN_ZOOM = 6;
const MAX_ZOOM = 16;
const BD = { lat: 23.7, lon: 90.35 };

function lonToX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function latToY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad));
  return ((1 - merc / Math.PI) / 2) * 2 ** zoom;
}

function xToLon(x: number, zoom: number) {
  return (x / 2 ** zoom) * 360 - 180;
}

function yToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Real street map from free OpenStreetMap tiles (CARTO). No WebView and no API key.
 */
export function HeatMapView({
  areas,
  onSelect,
  height = 460,
  onGestureStart,
  onGestureEnd,
}: HeatMapViewProps) {
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(6);
  const [center, setCenter] = useState(BD);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);

  const live = useRef({ zoom, center, onGestureStart, onGestureEnd });
  live.current = { zoom, center, onGestureStart, onGestureEnd };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        live.current.onGestureStart?.();
      },
      onPanResponderMove: (_, g) => {
        setDrag({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        const { zoom: z, center: c } = live.current;
        const x = lonToX(c.lon, z) - g.dx / TILE;
        const y = latToY(c.lat, z) - g.dy / TILE;
        setCenter({
          lon: xToLon(x, z),
          lat: clamp(yToLat(y, z), -80, 80),
        });
        setDrag({ x: 0, y: 0 });
        live.current.onGestureEnd?.();
      },
      onPanResponderTerminate: () => {
        setDrag({ x: 0, y: 0 });
        live.current.onGestureEnd?.();
      },
    }),
  ).current;

  const tiles = useMemo(() => {
    if (width <= 0) return [];
    const n = 2 ** zoom;
    const left = lonToX(center.lon, zoom) - width / 2 / TILE;
    const top = latToY(center.lat, zoom) - height / 2 / TILE;
    const x0 = Math.floor(left) - 1;
    const y0 = Math.floor(top) - 1;
    const x1 = Math.floor(left + width / TILE) + 1;
    const y1 = Math.floor(top + height / TILE) + 1;
    const list: { key: string; uri: string; left: number; top: number }[] = [];
    for (let ty = y0; ty <= y1; ty += 1) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = x0; tx <= x1; tx += 1) {
        const wrapped = ((tx % n) + n) % n;
        list.push({
          key: `${zoom}-${wrapped}-${ty}`,
          uri: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${wrapped}`,
          left: (tx - left) * TILE,
          top: (ty - top) * TILE,
        });
      }
    }
    return list;
  }, [width, height, zoom, center.lat, center.lon]);

  const markers = useMemo(() => {
    if (width <= 0) return [];
    const left = lonToX(center.lon, zoom) - width / 2 / TILE;
    const top = latToY(center.lat, zoom) - height / 2 / TILE;
    return areas.map((area) => {
      const x = (lonToX(area.location.lon, zoom) - left) * TILE;
      const y = (latToY(area.location.lat, zoom) - top) * TILE;
      const r = Math.round(
        Math.max(8, Math.min(18, 7 + Math.sqrt(area.caseCount) * 2)),
      );
      const zoneR = Math.max(
        18,
        heatRadiusMeters(area.caseCount) / metersPerPixel(area.location.lat, zoom),
      );
      return { area, x, y, r, zoneR, color: HEAT_COLORS[area.level] };
    });
  }, [areas, width, height, zoom, center.lat, center.lon]);

  const zoomBy = (delta: number) => {
    setZoom((z) => clamp(z + delta, MIN_ZOOM, MAX_ZOOM));
  };

  return (
    <View
      className="overflow-hidden rounded-3xl border border-border bg-neutral"
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View
        style={{ flex: 1, transform: [{ translateX: drag.x }, { translateY: drag.y }] }}
        {...pan.panHandlers}
      >
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.uri }}
            style={{
              position: "absolute",
              left: tile.left,
              top: tile.top,
              width: TILE,
              height: TILE,
            }}
            cachePolicy="memory-disk"
            recyclingKey={tile.key}
          />
        ))}
        {markers.map((m) => (
          <View
            key={`${m.area.location.slug}-zone`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: m.x - m.zoneR,
              top: m.y - m.zoneR,
              width: m.zoneR * 2,
              height: m.zoneR * 2,
              borderRadius: m.zoneR,
              backgroundColor: m.color,
              opacity: 0.22,
              borderWidth: 2,
              borderColor: m.color,
            }}
          />
        ))}
        {markers.map((m) => {
          const active = selected === m.area.location.slug;
          return (
            <Pressable
              key={m.area.location.slug}
              onPress={() => {
                setSelected(m.area.location.slug);
                onSelect(m.area.location.slug);
              }}
              accessibilityRole="button"
              accessibilityLabel={m.area.location.nameBn}
              style={{
                position: "absolute",
                left: m.x - m.r,
                top: m.y - m.r,
                width: m.r * 2,
                height: m.r * 2,
                borderRadius: m.r,
                backgroundColor: m.color,
                borderWidth: active ? 3 : 2,
                borderColor: active ? colors.ink : "#FFFFFF",
                opacity: 0.92,
              }}
            />
          );
        })}
      </View>

      <View className="absolute right-3 top-3 gap-2">
        <Pressable
          onPress={() => zoomBy(1)}
          accessibilityRole="button"
          accessibilityLabel="বড় করুন"
          className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
        >
          <Ionicons name="add" size={22} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => zoomBy(-1)}
          accessibilityRole="button"
          accessibilityLabel="ছোট করুন"
          className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
        >
          <Ionicons name="remove" size={22} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => {
            setZoom(6);
            setCenter(BD);
          }}
          accessibilityRole="button"
          accessibilityLabel="বাংলাদেশ দেখুন"
          className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
        >
          <Ionicons name="locate-outline" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View className="absolute bottom-2 left-2 rounded-md bg-card/90 px-1.5 py-0.5">
        <AppText variant="caption" className="text-muted" style={{ fontSize: 10 }}>
          © Esri © OpenStreetMap
        </AppText>
      </View>
    </View>
  );
}
