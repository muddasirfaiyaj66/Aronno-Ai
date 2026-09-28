"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { HeatmapArea, HeatLevel } from "@/lib/publicApi";
import { HEAT_COLORS, HEAT_LABEL_BN } from "@/lib/publicApi";
import "leaflet/dist/leaflet.css";

const BD_CENTER: [number, number] = [23.685, 90.3563];
const BD_ZOOM = 7;

function FitAreas({ areas }: { areas: HeatmapArea[] }) {
  const map = useMap();
  useEffect(() => {
    if (areas.length === 0) {
      map.setView(BD_CENTER, BD_ZOOM);
      return;
    }
    const lats = areas.map((a) => a.location.lat);
    const lons = areas.map((a) => a.location.lon);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.4, Math.min(...lons) - 0.4],
        [Math.max(...lats) + 0.4, Math.max(...lons) + 0.4],
      ],
      { padding: [28, 28], maxZoom: 9 },
    );
  }, [areas, map]);
  return null;
}

function radiusFor(level: HeatLevel, caseCount: number) {
  const base = level === "high" ? 18 : level === "medium" ? 14 : 10;
  return Math.min(28, base + Math.sqrt(caseCount));
}

export type DiseaseHeatMapProps = {
  areas: HeatmapArea[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  className?: string;
};

export function DiseaseHeatMap({
  areas,
  selectedSlug,
  onSelect,
  className,
}: DiseaseHeatMapProps) {
  const markers = useMemo(
    () =>
      areas.filter(
        (a) =>
          Number.isFinite(a.location.lat) && Number.isFinite(a.location.lon),
      ),
    [areas],
  );

  return (
    <div
      className={
        className ??
        "map-frame h-[min(70vh,560px)] w-full overflow-hidden rounded-2xl border border-border"
      }
    >
      <MapContainer
        center={BD_CENTER}
        zoom={BD_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#dce8e1" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitAreas areas={markers} />
        {markers.map((area) => {
          const active = area.location.slug === selectedSlug;
          const color = HEAT_COLORS[area.level];
          return (
            <CircleMarker
              key={area.location.slug}
              center={[area.location.lat, area.location.lon]}
              radius={radiusFor(area.level, area.caseCount) + (active ? 4 : 0)}
              pathOptions={{
                color: active ? "#0a281f" : color,
                weight: active ? 3 : 1.5,
                fillColor: color,
                fillOpacity: active ? 0.75 : 0.55,
              }}
              eventHandlers={{
                click: () => onSelect(area.location.slug),
              }}
            >
              <Popup>
                <strong>{area.location.nameBn}</strong>
                <br />
                প্রাদুর্ভাব: {HEAT_LABEL_BN[area.level]} · {area.caseCount}টি
                রিপোর্ট
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/** Client wrapper that only mounts the map after hydration. */
export function DiseaseHeatMapClient(props: DiseaseHeatMapProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <div
        className={
          props.className ??
          "flex h-[min(70vh,560px)] w-full items-center justify-center rounded-2xl border border-border bg-panel text-sm text-muted"
        }
      >
        মানচিত্র লোড হচ্ছে…
      </div>
    );
  }
  return <DiseaseHeatMap {...props} />;
}
