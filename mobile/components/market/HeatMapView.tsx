import { useMemo, useState } from "react";
import {
  Linking,
  NativeModules,
  Pressable,
  TurboModuleRegistry,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { AppText } from "@/components/ui";
import type { HeatmapArea } from "@/types/market";
import { heatmapHtml, HEAT_COLORS } from "./heatmapHtml";

export type HeatMapViewProps = {
  areas: HeatmapArea[];
  onSelect: (slug: string) => void;
  height?: number;
};

const WEB_HEATMAP_URL =
  process.env.EXPO_PUBLIC_WEB_URL
    ? `${process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, "")}/heatmap`
    : "https://aronnoaibd.vercel.app/heatmap";

/** Geographic frame used for lat/lon → SVG projection. */
const BD = {
  south: 20.55,
  north: 26.75,
  west: 88.0,
  east: 92.7,
};

/**
 * Simplified Bangladesh land outline (lon, lat rings) — enough for a clear
 * national silhouette behind district heat bubbles.
 */
const BD_OUTLINE: [number, number][] = [
  [88.1, 21.5],
  [88.05, 21.9],
  [88.15, 22.5],
  [88.35, 22.95],
  [88.55, 23.55],
  [88.75, 24.15],
  [88.5, 24.7],
  [88.15, 25.2],
  [88.1, 25.75],
  [88.35, 26.35],
  [88.7, 26.55],
  [89.25, 26.65],
  [89.85, 26.4],
  [90.35, 26.15],
  [90.65, 25.85],
  [91.1, 25.35],
  [91.55, 25.05],
  [92.05, 24.85],
  [92.35, 24.4],
  [92.45, 23.7],
  [92.25, 23.1],
  [92.05, 22.55],
  [92.15, 21.85],
  [92.05, 21.35],
  [91.85, 21.05],
  [91.45, 21.2],
  [91.0, 21.55],
  [90.55, 21.75],
  [90.15, 21.85],
  [89.75, 21.95],
  [89.35, 21.85],
  [88.95, 21.7],
  [88.55, 21.55],
  [88.25, 21.45],
];

type WebViewComponent = React.ComponentType<{
  originWhitelist?: string[];
  source: { html: string; baseUrl?: string };
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  nestedScrollEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
  style?: object;
}>;

function nativeWebViewAvailable(): boolean {
  try {
    const turbo = TurboModuleRegistry.get?.("RNCWebViewModule");
    if (turbo) return true;
    if (NativeModules.RNCWebViewModule) return true;
    if (NativeModules.RNCWebView) return true;
  } catch {
    // ignore
  }
  return false;
}

function loadWebView(): WebViewComponent | null {
  if (!nativeWebViewAvailable()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-webview") as {
      WebView?: WebViewComponent;
    };
    return mod.WebView ?? null;
  } catch {
    return null;
  }
}

function project(
  lon: number,
  lat: number,
  w: number,
  h: number,
  pad = 12,
): { x: number; y: number } {
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const x = pad + ((lon - BD.west) / (BD.east - BD.west)) * usableW;
  const y = pad + ((BD.north - lat) / (BD.north - BD.south)) * usableH;
  return { x, y };
}

function outlinePath(w: number, h: number): string {
  return (
    BD_OUTLINE.map((pt, i) => {
      const { x, y } = project(pt[0], pt[1], w, h);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ") + " Z"
  );
}

function bubbleRadius(caseCount: number, mapH: number): number {
  const base = Math.max(10, Math.min(28, 9 + Math.sqrt(caseCount) * 3.2));
  return Math.min(base, mapH * 0.07);
}

function SvgHeatMap({
  areas,
  onSelect,
  height = 380,
  selectedSlug,
}: HeatMapViewProps & { selectedSlug?: string | null }) {
  const [width, setWidth] = useState(0);

  const markers = useMemo(() => {
    if (width <= 0) return [];
    return areas.map((a) => {
      const { x, y } = project(a.location.lon, a.location.lat, width, height);
      return {
        ...a,
        x,
        y,
        r: bubbleRadius(a.caseCount, height),
        color: HEAT_COLORS[a.level] ?? HEAT_COLORS.low,
      };
    });
  }, [areas, width, height]);

  return (
    <View
      className="overflow-hidden rounded-3xl border border-border bg-white"
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="bdFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#D8E8DE" stopOpacity="1" />
              <Stop offset="1" stopColor="#B7D4C4" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="#EEF4F0" />
          <Rect
            x={0}
            y={height * 0.72}
            width={width}
            height={height * 0.28}
            fill="#C9DDE8"
            opacity={0.55}
          />
          <Path
            d={outlinePath(width, height)}
            fill="url(#bdFill)"
            stroke="#0F766E"
            strokeWidth={1.5}
            opacity={0.95}
          />
          {markers.map((m) => {
            const selected = m.location.slug === selectedSlug;
            return (
              <Circle
                key={m.location.slug}
                cx={m.x}
                cy={m.y}
                r={selected ? m.r + 3 : m.r}
                fill={m.color}
                fillOpacity={selected ? 0.78 : 0.58}
                stroke={selected ? "#115E59" : "#FFFFFF"}
                strokeWidth={selected ? 3 : 1.5}
                onPress={() => onSelect(m.location.slug)}
              />
            );
          })}
          {markers
            .filter(
              (m) =>
                m.location.slug === selectedSlug ||
                m.level === "high" ||
                m.caseCount >= 5,
            )
            .map((m) => (
              <SvgText
                key={`${m.location.slug}-label`}
                x={m.x}
                y={m.y + m.r + 12}
                fill="#1C2B24"
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
                onPress={() => onSelect(m.location.slug)}
              >
                {m.location.nameBn}
              </SvgText>
            ))}
        </Svg>
      ) : null}

      <Pressable
        onPress={() => {
          void Linking.openURL(WEB_HEATMAP_URL);
        }}
        className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 active:opacity-80"
        style={{
          borderWidth: 1,
          borderColor: "#D5DDD8",
        }}
      >
        <AppText
          variant="caption"
          className="font-bengali-semibold text-primary"
        >
          OSM পূর্ণ মানচিত্র →
        </AppText>
      </Pressable>
    </View>
  );
}

function OsmWebHeatMap({
  WebView,
  areas,
  onSelect,
  height,
}: HeatMapViewProps & { WebView: WebViewComponent }) {
  const html = useMemo(() => heatmapHtml(areas, "native"), [areas]);

  return (
    <View
      className="overflow-hidden rounded-3xl border border-border"
      style={{ height }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://aronno.app/" }}
        onMessage={(e) => onSelect(e.nativeEvent.data)}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}

/**
 * Disease heat map for Market tab.
 * Prefer OSM WebView when the native module is in the binary; otherwise render
 * an SVG Bangladesh map (works without RNCWebViewModule).
 */
export function HeatMapView({
  areas,
  onSelect,
  height = 380,
}: HeatMapViewProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const WebView = useMemo(() => loadWebView(), []);

  const handleSelect = (slug: string) => {
    setSelectedSlug(slug);
    onSelect(slug);
  };

  if (WebView) {
    return (
      <OsmWebHeatMap
        WebView={WebView}
        areas={areas}
        onSelect={handleSelect}
        height={height}
      />
    );
  }

  return (
    <SvgHeatMap
      areas={areas}
      onSelect={handleSelect}
      height={height}
      selectedSlug={selectedSlug}
    />
  );
}
