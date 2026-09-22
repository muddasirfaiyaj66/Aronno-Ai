import { createBleTransport } from "./bleTransport";
import { createMockBleTransport, createMockWifiTransport } from "./mockTransport";
import type { SoilTransport } from "./ports";
import type {
  SoilConnectionState,
  SoilReading,
  SoilSensorDevice,
  SoilTransportKind,
} from "./types";
import { SoilSensorError } from "./types";
import { createWifiTransport } from "./wifiTransport";
import { WIFI_PROTOCOL } from "./protocol";

export type SensorMode = "live" | "demo";

/**
 * Facade over BLE + Wi‑Fi (+ demo mocks).
 * UI talks only to this manager.
 */
export class SoilSensorManager {
  private mode: SensorMode = "demo";
  private activeKind: SoilTransportKind = "bluetooth";
  private transports: Record<SoilTransportKind, SoilTransport>;
  private state: SoilConnectionState = "idle";
  private lastError: string | null = null;
  private lastReading: SoilReading | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    this.transports = this.buildTransports("demo");
  }

  private buildTransports(mode: SensorMode): Record<SoilTransportKind, SoilTransport> {
    if (mode === "demo") {
      return {
        bluetooth: createMockBleTransport(),
        wifi: createMockWifiTransport(),
      };
    }
    return {
      bluetooth: createBleTransport(),
      wifi: createWifiTransport(),
    };
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private setState(state: SoilConnectionState, error?: string | null) {
    this.state = state;
    this.lastError = error ?? null;
    this.emit();
  }

  getSnapshot() {
    return {
      mode: this.mode,
      transport: this.activeKind,
      state: this.state,
      error: this.lastError,
      connected: this.current().getConnected(),
      reading: this.lastReading,
    };
  }

  setMode(mode: SensorMode) {
    void this.current().disconnect();
    this.mode = mode;
    this.transports = this.buildTransports(mode);
    this.lastReading = null;
    this.setState("idle");
  }

  setTransport(kind: SoilTransportKind) {
    void this.current().disconnect();
    this.activeKind = kind;
    this.lastReading = null;
    this.setState("idle");
  }

  private current() {
    return this.transports[this.activeKind];
  }

  async scan(onDevice: (d: SoilSensorDevice) => void) {
    const t = this.current();
    if (!t.supportsScan) {
      throw new SoilSensorError(
        "scan_failed",
        "ওয়াই‑ফাইতে স্ক্যান নেই — IP লিখে সংযুক্ত করুন।",
      );
    }
    this.setState("scanning");
    try {
      await t.scan(onDevice);
      this.setState(t.getConnected() ? "connected" : "idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "স্ক্যান ব্যর্থ";
      this.setState("error", msg);
      throw err;
    }
  }

  async stopScan() {
    await this.current().stopScan();
    if (this.state === "scanning") this.setState("idle");
  }

  async connectBluetooth(device: SoilSensorDevice) {
    this.activeKind = "bluetooth";
    this.setState("connecting");
    try {
      await this.transports.bluetooth.connect(device);
      this.setState("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "সংযোগ ব্যর্থ";
      this.setState("error", msg);
      throw err;
    }
  }

  async connectWifi(opts: { baseUrl: string; name?: string }) {
    this.activeKind = "wifi";
    const baseUrl = opts.baseUrl.trim().replace(/\/$/, "") || WIFI_PROTOCOL.defaultBaseUrl;
    const device: SoilSensorDevice = {
      id: `wifi:${baseUrl}`,
      name: opts.name ?? "AronnoSoil Wi‑Fi",
      transport: "wifi",
      baseUrl,
    };
    this.setState("connecting");
    try {
      await this.transports.wifi.connect(device);
      this.setState("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ওয়াই‑ফাই সংযোগ ব্যর্থ";
      this.setState("error", msg);
      throw err;
    }
  }

  async disconnect() {
    await this.current().disconnect();
    this.setState("idle");
  }

  async read(): Promise<SoilReading> {
    this.setState("reading");
    try {
      const reading = await this.current().read();
      this.lastReading = reading;
      this.setState("connected");
      return reading;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "পড়া ব্যর্থ";
      this.setState("error", msg);
      throw err;
    }
  }
}

let singleton: SoilSensorManager | null = null;

export function getSoilSensorManager() {
  if (!singleton) singleton = new SoilSensorManager();
  return singleton;
}
