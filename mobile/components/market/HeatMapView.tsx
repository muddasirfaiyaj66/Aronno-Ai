import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import type { HeatmapArea } from "@/types/market";
import { heatmapHtml } from "./heatmapHtml";

export type HeatMapViewProps = {
  areas: HeatmapArea[];
  onSelect: (slug: string) => void;
  height?: number;
};

export function HeatMapView({ areas, onSelect, height = 380 }: HeatMapViewProps) {
  const html = useMemo(() => heatmapHtml(areas, "native"), [areas]);

  return (
    <View className="overflow-hidden rounded-3xl border border-border" style={{ height }}>
      <WebView
        originWhitelist={["*"]}
        // A real origin gives OSM tile requests a Referer, per their usage policy.
        source={{ html, baseUrl: "https://aronno.app/" }}
        onMessage={(e) => onSelect(e.nativeEvent.data)}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
