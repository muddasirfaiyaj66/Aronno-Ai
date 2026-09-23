import { useEffect, useMemo } from "react";
import { View } from "react-native";
import type { HeatmapArea } from "@/types/market";
import { heatmapHtml } from "./heatmapHtml";

export type HeatMapViewProps = {
  areas: HeatmapArea[];
  onSelect: (slug: string) => void;
  height?: number;
};

export function HeatMapView({ areas, onSelect, height = 380 }: HeatMapViewProps) {
  const html = useMemo(() => heatmapHtml(areas, "iframe"), [areas]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { source?: string; slug?: string } | null;
      if (data?.source === "aronno-heatmap" && data.slug) onSelect(data.slug);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect]);

  return (
    <View className="overflow-hidden rounded-3xl border border-border" style={{ height }}>
      <iframe
        title="রোগের হিট ম্যাপ"
        srcDoc={html}
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    </View>
  );
}
