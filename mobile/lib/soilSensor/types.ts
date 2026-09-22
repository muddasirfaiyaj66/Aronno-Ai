/** Shared soil-sensor types for Bluetooth + WiFi transports. */

export type SoilTransportKind = "bluetooth" | "wifi";

export type SoilConnectionState =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "reading"
  | "error";

export type SoilSensorDevice = {
  id: string;
  name: string;
  transport: SoilTransportKind;
  /** WiFi only — base URL like http://192.168.4.1 */
  baseUrl?: string;
  /** BLE only — RSSI when discovered */
  rssi?: number;
  mock?: boolean;
};

/**
 * Canonical soil sample from Aronno field hardware.
 * Units match docs/hardware_soil_sensor.md — keep firmware in sync.
 */
export type SoilReading = {
  /** ISO timestamp from phone or device */
  measuredAt: string;
  transport: SoilTransportKind;
  deviceId: string;
  deviceName: string;
  /** Soil moisture 0–100 % */
  moisturePct: number;
  /** Soil temperature °C */
  temperatureC: number;
  /** pH 0–14 */
  ph: number;
  /** Electrical conductivity mS/cm */
  ecMsCm: number;
  /** Nitrogen ppm (approx) */
  nitrogenPpm: number;
  /** Phosphorus ppm */
  phosphorusPpm: number;
  /** Potassium ppm */
  potassiumPpm: number;
  /** Optional battery % when probe reports it */
  batteryPct?: number;
};

export type CropSuitability = {
  cropSlug: string;
  nameBn: string;
  nameEn: string;
  score: number;
  fit: "excellent" | "good" | "fair" | "poor";
  reasonsBn: string[];
};

export type SoilSensorErrorCode =
  | "bluetooth_unavailable"
  | "bluetooth_powered_off"
  | "permission_denied"
  | "scan_failed"
  | "connect_failed"
  | "read_failed"
  | "wifi_unreachable"
  | "wifi_bad_response"
  | "not_connected"
  | "cancelled";

export class SoilSensorError extends Error {
  constructor(
    public readonly code: SoilSensorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SoilSensorError";
  }
}
