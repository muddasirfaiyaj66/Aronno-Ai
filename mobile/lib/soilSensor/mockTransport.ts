import { parseSoilPayload } from "./protocol";
import type { SoilTransport } from "./ports";
import type { SoilReading, SoilSensorDevice } from "./types";
import { SoilSensorError } from "./types";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fakePayload(seed: number) {
  const wobble = (base: number, span: number) =>
    Math.round((base + (Math.sin(seed) * span + Math.random() * span * 0.4)) * 10) /
    10;
  return {
    m: wobble(55, 15),
    t: wobble(28, 4),
    ph: wobble(6.4, 0.6),
    ec: wobble(1.2, 0.5),
    n: Math.round(wobble(45, 20)),
    p: Math.round(wobble(25, 12)),
    k: Math.round(wobble(80, 30)),
    bat: Math.round(wobble(82, 10)),
  };
}

const MOCK_BLE: SoilSensorDevice = {
  id: "mock-ble-aronno-01",
  name: "AronnoSoil-DEMO",
  transport: "bluetooth",
  rssi: -48,
  mock: true,
};

const MOCK_WIFI: SoilSensorDevice = {
  id: "mock-wifi-aronno-01",
  name: "AronnoSoil Wi‑Fi (ডেমো)",
  transport: "wifi",
  baseUrl: "http://192.168.4.1",
  mock: true,
};

/** Deterministic mock BLE — test UI without hardware. */
export function createMockBleTransport(): SoilTransport {
  let connected: SoilSensorDevice | null = null;
  let scanning = false;
  let seed = Date.now() / 1000;

  return {
    kind: "bluetooth",
    labelBn: "ব্লুটুথ (ডেমো)",
    supportsScan: true,

    async isAvailable() {
      return true;
    },

    async scan(onDevice) {
      scanning = true;
      await delay(600);
      if (!scanning) return;
      onDevice(MOCK_BLE);
      await delay(400);
      if (!scanning) return;
      onDevice({
        ...MOCK_BLE,
        id: "mock-ble-aronno-02",
        name: "AronnoSoil-TEST2",
        rssi: -62,
      });
    },

    async stopScan() {
      scanning = false;
    },

    async connect(device) {
      await delay(500);
      connected = { ...device, mock: true };
    },

    async disconnect() {
      connected = null;
    },

    async read() {
      if (!connected) {
        throw new SoilSensorError("not_connected", "আগে ব্লুটুথ ডিভাইস সংযুক্ত করুন।");
      }
      await delay(700);
      seed += 1;
      return parseSoilPayload(fakePayload(seed), {
        transport: "bluetooth",
        deviceId: connected.id,
        deviceName: connected.name,
      });
    },

    getConnected() {
      return connected;
    },
  };
}

/** Deterministic mock Wi‑Fi — test UI without hardware. */
export function createMockWifiTransport(
  fixedBaseUrl?: string,
): SoilTransport {
  let connected: SoilSensorDevice | null = null;
  let seed = Date.now() / 1000;

  return {
    kind: "wifi",
    labelBn: "ওয়াই‑ফাই (ডেমো)",
    supportsScan: false,

    async isAvailable() {
      return true;
    },

    async scan() {
      // Soft-AP devices aren't discoverable via Wi‑Fi scan in JS without native APIs.
    },

    async stopScan() {},

    async connect(device) {
      await delay(400);
      connected = {
        ...device,
        baseUrl: device.baseUrl ?? fixedBaseUrl ?? MOCK_WIFI.baseUrl,
        mock: true,
        transport: "wifi",
      };
    },

    async disconnect() {
      connected = null;
    },

    async read(): Promise<SoilReading> {
      if (!connected) {
        throw new SoilSensorError("not_connected", "আগে ওয়াই‑ফাই সেন্সর সংযুক্ত করুন।");
      }
      await delay(600);
      seed += 1.3;
      return parseSoilPayload(fakePayload(seed), {
        transport: "wifi",
        deviceId: connected.id,
        deviceName: connected.name,
      });
    },

    getConnected() {
      return connected;
    },
  };
}

export { MOCK_BLE, MOCK_WIFI };
