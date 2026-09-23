import type { HeatLevel, HeatmapArea } from "@/types/market";

/** Map zone colours: green = low, yellow = moderate, red = high. */
export const HEAT_COLORS: Record<HeatLevel, string> = {
  low: "#22A06B",
  medium: "#E8B100",
  high: "#D92D20",
};

/** Bangladesh bounding box — the map always opens framed on the country. */
const BD_BOUNDS = [
  [20.6, 88.0],
  [26.7, 92.7],
];

type Zone = {
  slug: string;
  lat: number;
  lon: number;
  radiusM: number;
  color: string;
  label: string;
};

function toZones(areas: HeatmapArea[]): Zone[] {
  return areas.map((a) => ({
    slug: a.location.slug,
    lat: a.location.lat,
    lon: a.location.lon,
    // ~12 km minimum, grows with the square root of the case count.
    radiusM: Math.round(12_000 + 5_000 * Math.sqrt(a.caseCount)),
    color: HEAT_COLORS[a.level],
    label: a.location.nameBn,
  }));
}

/**
 * Self-contained Leaflet page on OpenStreetMap tiles (no API key). Tapping a
 * zone posts its district slug back to the host via `postMessage`.
 */
export function heatmapHtml(areas: HeatmapArea[], bridge: "native" | "iframe") {
  const zones = JSON.stringify(toZones(areas)).replace(/</g, "\\u003c");
  const post =
    bridge === "native"
      ? "window.ReactNativeWebView.postMessage(slug)"
      : "window.parent.postMessage({ source: 'aronno-heatmap', slug: slug }, '*')";
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #EEF2EF; }
  .leaflet-tooltip { font-family: sans-serif; font-weight: 700; font-size: 13px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var zones = ${zones};
  var map = L.map('map', { zoomControl: true, attributionControl: true });
  map.fitBounds(${JSON.stringify(BD_BOUNDS)});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    maxZoom: 12,
    minZoom: 6,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  var selected = null;
  zones.forEach(function (z) {
    var circle = L.circle([z.lat, z.lon], {
      radius: z.radiusM,
      color: z.color,
      weight: 2,
      fillColor: z.color,
      fillOpacity: 0.45
    }).addTo(map);
    circle.bindTooltip(z.label, { direction: 'top' });
    circle.on('click', function () {
      if (selected) selected.setStyle({ weight: 2 });
      circle.setStyle({ weight: 5 });
      selected = circle;
      var slug = z.slug;
      ${post};
    });
  });
</script>
</body>
</html>`;
}
