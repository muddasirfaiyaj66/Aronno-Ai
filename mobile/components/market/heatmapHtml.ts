import type { HeatLevel, HeatmapArea } from "@/types/market";

/** Map zone colours: green = low, yellow = moderate, red = high. */
export const HEAT_COLORS: Record<HeatLevel, string> = {
  low: "#22A06B",
  medium: "#E8B100",
  high: "#D92D20",
};

/** Bangladesh bounding box — the map always opens framed on the country. */
const BD_BOUNDS = [
  [20.55, 88.0],
  [26.7, 92.75],
];

type Zone = {
  slug: string;
  lat: number;
  lon: number;
  radius: number;
  color: string;
  label: string;
};

function toZones(areas: HeatmapArea[]): Zone[] {
  return areas.map((a) => ({
    slug: a.location.slug,
    lat: a.location.lat,
    lon: a.location.lon,
    radius: Math.round(Math.max(9, Math.min(20, 8 + Math.sqrt(a.caseCount) * 2.4))),
    color: HEAT_COLORS[a.level],
    label: `${a.location.nameBn} · ${a.caseCount}`,
  }));
}

/**
 * Leaflet map on free Esri street tiles (no API key).
 * Tapping a district posts its slug back to the host.
 */
export function heatmapHtml(
  areas: HeatmapArea[],
  bridge: "native" | "iframe",
  scheme: "light" | "dark" = "light",
) {
  const zones = JSON.stringify(toZones(areas)).replace(/</g, "\\u003c");
  const post =
    bridge === "native"
      ? "window.ReactNativeWebView.postMessage(slug)"
      : "window.parent.postMessage({ source: 'aronno-heatmap', slug: slug }, '*')";
  const tiles =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
  const labelColor = scheme === "dark" ? "#E7F3EF" : "#13241F";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: ${scheme === "dark" ? "#0C1614" : "#E7EEEB"}; }
  .leaflet-tooltip {
    font-family: sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: ${labelColor};
    border: 0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  .leaflet-control-attribution { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var zones = ${zones};
  var map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
    maxZoom: 18,
    minZoom: 6
  });
  map.fitBounds(${JSON.stringify(BD_BOUNDS)}, { padding: [12, 12], maxZoom: 7 });
  L.tileLayer("${tiles}", {
    maxZoom: 19,
    attribution: "&copy; Esri &copy; OpenStreetMap"
  }).addTo(map);
  var selected = null;
  zones.forEach(function (z) {
    var marker = L.circleMarker([z.lat, z.lon], {
      radius: z.radius,
      color: "#ffffff",
      weight: 2,
      fillColor: z.color,
      fillOpacity: 0.88
    }).addTo(map);
    marker.bindTooltip(z.label, { direction: "top", offset: [0, -4] });
    marker.on("click", function () {
      if (selected && selected !== marker) {
        selected.setStyle({ weight: 2, color: "#ffffff" });
        selected.closeTooltip();
      }
      marker.setStyle({ weight: 4, color: z.color });
      marker.openTooltip();
      selected = marker;
      var slug = z.slug;
      ${post};
    });
  });
  setTimeout(function () { map.invalidateSize(); }, 250);
</script>
</body>
</html>`;
}
