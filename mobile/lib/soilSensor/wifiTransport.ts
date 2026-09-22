import { WIFI_PROTOCOL, parseSoilPayload } from "./protocol";
import type { SoilTransport } from "./ports";
import type { SoilSensorDevice } from "./types";
import { SoilSensorError } from "./types";

function withTimeout<T>(promise: Promise<T>, ms: number, code: SoilSensorError["code"], msg: string) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SoilSensorError(code, msg)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Real Wi‑Fi transport — HTTP to the probe's soft-AP / LAN API.
 * Expects GET {baseUrl}/api/soil → compact JSON (see protocol.ts).
 */
export function createWifiTransport(): SoilTransport {
  let connected: SoilSensorDevice | null = null;

  return {
    kind: "wifi",
    labelBn: "ওয়াই‑ফাই",
    supportsScan: false,

    async isAvailable() {
      return true;
    },

    async scan() {},

    async stopScan() {},

    async connect(device) {
      const baseUrl = (device.baseUrl ?? WIFI_PROTOCOL.defaultBaseUrl).replace(/\/$/, "");
      try {
        const res = await withTimeout(
          fetch(`${baseUrl}${WIFI_PROTOCOL.healthPath}`),
          WIFI_PROTOCOL.requestTimeoutMs,
          "wifi_unreachable",
          "ওয়াই‑ফাই সেন্সর পাওয়া যায়নি। ফোন একই নেটওয়ার্কে আছে কি?",
        );
        if (!res.ok) {
          throw new SoilSensorError(
            "wifi_unreachable",
            `সেন্সর স্বাস্থ্য পরীক্ষা ব্যর্থ (HTTP ${res.status})।`,
          );
        }
      } catch (err) {
        if (err instanceof SoilSensorError) throw err;
        throw new SoilSensorError(
          "wifi_unreachable",
          "ওয়াই‑ফাই সেন্সর পাওয়া যায়নি। SSID/IP ঠিক আছে কি?",
        );
      }
      connected = {
        ...device,
        id: device.id || `wifi:${baseUrl}`,
        name: device.name || "AronnoSoil Wi‑Fi",
        baseUrl,
        transport: "wifi",
      };
    },

    async disconnect() {
      connected = null;
    },

    async read() {
      if (!connected?.baseUrl) {
        throw new SoilSensorError("not_connected", "আগে ওয়াই‑ফাই সেন্সর সংযুক্ত করুন।");
      }
      try {
        const res = await withTimeout(
          fetch(`${connected.baseUrl}${WIFI_PROTOCOL.readingPath}`),
          WIFI_PROTOCOL.requestTimeoutMs,
          "read_failed",
          "মাটির তথ্য পড়া যায়নি।",
        );
        if (!res.ok) {
          throw new SoilSensorError(
            "wifi_bad_response",
            `সেন্সর উত্তর ভুল (HTTP ${res.status})।`,
          );
        }
        const json: unknown = await res.json();
        return parseSoilPayload(json, {
          transport: "wifi",
          deviceId: connected.id,
          deviceName: connected.name,
        });
      } catch (err) {
        if (err instanceof SoilSensorError) throw err;
        throw new SoilSensorError("read_failed", "মাটির তথ্য পড়া যায়নি।");
      }
    },

    getConnected() {
      return connected;
    },
  };
}
