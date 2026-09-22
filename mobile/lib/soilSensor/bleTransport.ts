import { PermissionsAndroid, Platform } from "react-native";
import { base64ToUtf8, utf8ToBase64 } from "./base64";
import { BLE_PROTOCOL, encodeReadCommand, parseSoilPayload } from "./protocol";
import type { SoilTransport } from "./ports";
import type { SoilSensorDevice } from "./types";
import { SoilSensorError } from "./types";

type BleModule = typeof import("@sfourdrinier/react-native-ble-plx");

let bleMod: BleModule | null | undefined;

async function loadBle(): Promise<BleModule | null> {
  if (bleMod !== undefined) return bleMod;
  try {
    bleMod = await import("@sfourdrinier/react-native-ble-plx");
    return bleMod;
  } catch {
    bleMod = null;
    return null;
  }
}

async function ensureAndroidBlePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  const api = typeof Platform.Version === "number" ? Platform.Version : 31;
  const perms =
    api >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(perms);
  const denied = Object.values(result).some(
    (v) => v !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied) {
    throw new SoilSensorError(
      "permission_denied",
      "ব্লুটুথ অনুমতি দিন — সেন্সর খুঁজে পাওয়া যাবে না।",
    );
  }
}

/**
 * Real Bluetooth Low Energy transport (needs custom dev client rebuild).
 * Falls back to "unavailable" if native module is missing (Expo Go).
 */
export function createBleTransport(): SoilTransport {
  let manager: InstanceType<BleModule["BleManager"]> | null = null;
  let connected: SoilSensorDevice | null = null;
  let connectedDevice: { id: string; cancelConnection: () => Promise<unknown> } | null =
    null;
  let stopScanFn: (() => void) | null = null;

  const getManager = async () => {
    const mod = await loadBle();
    if (!mod) {
      throw new SoilSensorError(
        "bluetooth_unavailable",
        "ব্লুটুথ মডিউল নেই। ডেভ ক্লায়েন্ট রিবিল্ড করুন (expo prebuild / EAS)।",
      );
    }
    if (!manager) manager = new mod.BleManager();
    return manager;
  };

  return {
    kind: "bluetooth",
    labelBn: "ব্লুটুথ",
    supportsScan: true,

    async isAvailable() {
      try {
        const mgr = await getManager();
        const state = await mgr.state();
        return state === "PoweredOn";
      } catch {
        return false;
      }
    },

    async scan(onDevice) {
      await ensureAndroidBlePermissions();
      const mgr = await getManager();
      const state = await mgr.state();
      if (state !== "PoweredOn") {
        throw new SoilSensorError(
          "bluetooth_powered_off",
          "ফোনের ব্লুটুথ চালু করুন।",
        );
      }

      await new Promise<void>((resolve, reject) => {
        const seen = new Set<string>();
        const timer = setTimeout(() => {
          mgr.stopDeviceScan();
          stopScanFn = null;
          resolve();
        }, BLE_PROTOCOL.scanTimeoutMs);

        stopScanFn = () => {
          clearTimeout(timer);
          mgr.stopDeviceScan();
          stopScanFn = null;
          resolve();
        };

        const handleDevice = (device: {
          id: string;
          name: string | null;
          localName?: string | null;
          rssi?: number | null;
          serviceUUIDs?: string[] | null;
        }) => {
          const name = device.name ?? device.localName ?? "";
          const matchName =
            !name ||
            name.startsWith(BLE_PROTOCOL.namePrefix) ||
            name.toLowerCase().includes("aronno");
          const matchService = device.serviceUUIDs?.some(
            (u) => u.toLowerCase() === BLE_PROTOCOL.serviceUuid.toLowerCase(),
          );
          if (!matchName && !matchService) return;
          if (seen.has(device.id)) return;
          seen.add(device.id);
          onDevice({
            id: device.id,
            name: name || `${BLE_PROTOCOL.namePrefix}-?`,
            transport: "bluetooth",
            rssi: device.rssi ?? undefined,
          });
        };

        mgr.startDeviceScan(
          [BLE_PROTOCOL.serviceUuid],
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              clearTimeout(timer);
              mgr.stopDeviceScan();
              stopScanFn = null;
              reject(
                new SoilSensorError(
                  "scan_failed",
                  error.message || "ব্লুটুথ স্ক্যান ব্যর্থ।",
                ),
              );
              return;
            }
            if (device) handleDevice(device);
          },
        );

        setTimeout(() => {
          if (seen.size > 0) return;
          mgr.stopDeviceScan();
          mgr.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error || !device) return;
            const name = device.name ?? device.localName ?? "";
            if (!name.startsWith(BLE_PROTOCOL.namePrefix)) return;
            handleDevice(device);
          });
        }, 3500);
      });
    },

    async stopScan() {
      stopScanFn?.();
      try {
        const mgr = await getManager();
        mgr.stopDeviceScan();
      } catch {
        // ignore
      }
    },

    async connect(device) {
      await ensureAndroidBlePermissions();
      const mgr = await getManager();
      try {
        await this.stopScan();
        const d = await mgr.connectToDevice(device.id, {
          timeout: BLE_PROTOCOL.connectTimeoutMs,
        });
        await d.discoverAllServicesAndCharacteristics();
        connectedDevice = d;
        connected = {
          id: device.id,
          name: device.name,
          transport: "bluetooth",
          rssi: device.rssi,
        };
      } catch (err) {
        connected = null;
        connectedDevice = null;
        throw new SoilSensorError(
          "connect_failed",
          err instanceof Error ? err.message : "ব্লুটুথ সংযোগ ব্যর্থ।",
        );
      }
    },

    async disconnect() {
      try {
        await connectedDevice?.cancelConnection();
      } catch {
        // ignore
      }
      connectedDevice = null;
      connected = null;
    },

    async read() {
      if (!connected || !connectedDevice) {
        throw new SoilSensorError("not_connected", "আগে ব্লুটুথ ডিভাইস সংযুক্ত করুন।");
      }
      const mgr = await getManager();
      try {
        try {
          await mgr.writeCharacteristicWithResponseForDevice(
            connected.id,
            BLE_PROTOCOL.serviceUuid,
            BLE_PROTOCOL.commandCharUuid,
            utf8ToBase64(encodeReadCommand()),
          );
        } catch {
          // Firmware may only expose notify/read data char
        }

        const char = await mgr.readCharacteristicForDevice(
          connected.id,
          BLE_PROTOCOL.serviceUuid,
          BLE_PROTOCOL.dataCharUuid,
        );
        const b64 = char.value;
        if (!b64) {
          throw new SoilSensorError("read_failed", "সেন্সর খালি উত্তর দিয়েছে।");
        }
        return parseSoilPayload(base64ToUtf8(b64), {
          transport: "bluetooth",
          deviceId: connected.id,
          deviceName: connected.name,
        });
      } catch (err) {
        if (err instanceof SoilSensorError) throw err;
        throw new SoilSensorError(
          "read_failed",
          err instanceof Error ? err.message : "ব্লুটুথ থেকে তথ্য পড়া যায়নি।",
        );
      }
    },

    getConnected() {
      return connected;
    },
  };
}
