/**
 * Aronno field soil-sensor wire protocol (BLE + WiFi).
 * Hardware firmware must match these UUIDs / paths / JSON keys.
 */

/** BLE GATT — custom 128-bit UUIDs (replace in firmware + here if you mint your own). */
export const BLE_PROTOCOL = {
  /** Devices advertise this local name prefix */
  namePrefix: "AronnoSoil",
  serviceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  /** Notify / read — UTF-8 JSON SoilReading payload (compact keys below) */
  dataCharUuid: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  /** Write — ASCII commands: "READ", "PING" */
  commandCharUuid: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  scanTimeoutMs: 12_000,
  connectTimeoutMs: 15_000,
} as const;

/**
 * WiFi — device soft-AP or LAN HTTP API.
 * Default soft-AP: SSID `AronnoSoil-XXXX`, gateway often 192.168.4.1
 */
export const WIFI_PROTOCOL = {
  defaultBaseUrl: "http://192.168.4.1",
  healthPath: "/api/health",
  readingPath: "/api/soil",
  /** Optional SSE/WS later: /api/soil/stream */
  requestTimeoutMs: 8_000,
} as const;

/** Compact JSON keys the probe sends over BLE notify or WiFi GET /api/soil */
export type SoilPayloadJson = {
  m: number; // moisturePct
  t: number; // temperatureC
  ph: number;
  ec: number; // ecMsCm
  n: number; // nitrogenPpm
  p: number; // phosphorusPpm
  k: number; // potassiumPpm
  bat?: number; // batteryPct
  ts?: string; // optional device ISO time
};

export function parseSoilPayload(
  raw: unknown,
  meta: { transport: "bluetooth" | "wifi"; deviceId: string; deviceName: string },
): import("./types").SoilReading {
  const o = (typeof raw === "string" ? JSON.parse(raw) : raw) as SoilPayloadJson;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

  return {
    measuredAt: o.ts && !Number.isNaN(Date.parse(o.ts)) ? o.ts : new Date().toISOString(),
    transport: meta.transport,
    deviceId: meta.deviceId,
    deviceName: meta.deviceName,
    moisturePct: clamp(Number(o.m), 0, 100),
    temperatureC: clamp(Number(o.t), -10, 60),
    ph: clamp(Number(o.ph), 0, 14),
    ecMsCm: clamp(Number(o.ec), 0, 20),
    nitrogenPpm: clamp(Number(o.n), 0, 500),
    phosphorusPpm: clamp(Number(o.p), 0, 500),
    potassiumPpm: clamp(Number(o.k), 0, 800),
    batteryPct:
      o.bat === undefined ? undefined : clamp(Number(o.bat), 0, 100),
  };
}

export function encodeReadCommand(): string {
  return "READ";
}
