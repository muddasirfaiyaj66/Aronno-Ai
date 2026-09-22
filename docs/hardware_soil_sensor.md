# Aronno soil sensor hardware protocol

The mobile app is ready for **Bluetooth (BLE)** and **Wi‑Fi** field soil probes.  
Firmware should follow this document so app testing is plug-and-play.

App screen: **Home → মাটি** (`scan/soil-sensor`).

| Mode | When to use |
|------|-------------|
| **ডেমো টেস্ট** | No hardware — mock BLE devices / mock Wi‑Fi readings + crop list |
| **আসল হার্ডওয়্যার** | Real probe over BLE or Wi‑Fi |

After changing BLE plugins, rebuild the **dev client** (`npx expo prebuild` / EAS). BLE does not work in Expo Go.

---

## Shared JSON payload

Both transports return the same compact JSON (UTF‑8):

```json
{
  "m": 58.2,
  "t": 27.5,
  "ph": 6.4,
  "ec": 1.15,
  "n": 42,
  "p": 28,
  "k": 95,
  "bat": 88,
  "ts": "2026-09-22T12:00:00.000Z"
}
```

| Key | Meaning | Unit / range |
|-----|---------|--------------|
| `m` | Moisture | 0–100 % |
| `t` | Temperature | °C |
| `ph` | pH | 0–14 |
| `ec` | Electrical conductivity | mS/cm |
| `n` / `p` / `k` | N / P / K | ppm (approx) |
| `bat` | Battery (optional) | 0–100 % |
| `ts` | Device time (optional) | ISO‑8601 |

---

## Bluetooth (BLE)

Constants live in `mobile/lib/soilSensor/protocol.ts` (`BLE_PROTOCOL`).

| Item | Value |
|------|--------|
| Advertise name prefix | `AronnoSoil` (e.g. `AronnoSoil-A1`) |
| Service UUID | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| Command characteristic (write) | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| Data characteristic (read / notify) | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |

**Flow**

1. Phone scans → connects → discovers services.
2. App writes ASCII `READ` (base64 on the wire) to the command char.
3. Probe updates the data char with the JSON above (UTF‑8).
4. App reads the data char (notify also OK later).

If your board uses different UUIDs, change **both** firmware and `BLE_PROTOCOL`.

Library: `@sfourdrinier/react-native-ble-plx` (Expo SDK 54 fork), config plugin in `app.json`.

---

## Wi‑Fi

Constants: `WIFI_PROTOCOL` in the same file.

Typical soft‑AP: SSID `AronnoSoil-XXXX`, gateway `http://192.168.4.1`.

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/api/health` | `200` + any body (app only checks OK) |
| `GET` | `/api/soil` | JSON payload above |

**Flow**

1. Farmer joins the probe’s Wi‑Fi (or LAN).
2. In app, enter base URL (default `http://192.168.4.1`) → **সংযুক্ত**.
3. **মাটির তথ্য পড়ুন** → `GET /api/soil` → crop suitability UI.

Cleartext HTTP on a local probe IP is expected in the field; use HTTPS only if you terminate TLS on the device.

---

## Crop suitability

`mobile/lib/soilSensor/cropSuitability.ts` scores crops (ধান, আলু, টমেটো, …) from pH, moisture, N, EC, temperature — **on device**, no internet required. Good for hardware bring‑up tests.

---

## Code map

| Path | Role |
|------|------|
| `lib/soilSensor/protocol.ts` | UUIDs, Wi‑Fi paths, JSON parse |
| `lib/soilSensor/bleTransport.ts` | Live BLE |
| `lib/soilSensor/wifiTransport.ts` | Live HTTP |
| `lib/soilSensor/mockTransport.ts` | Demo BLE + Wi‑Fi |
| `lib/soilSensor/sensorManager.ts` | Facade used by UI |
| `app/(root)/(tabs)/scan/soil-sensor.tsx` | Farmer UI |

---

## Hardware bring‑up checklist

1. App: **ডেমো টেস্ট** → BLE scan → connect → read → see metrics + crops.
2. App: **ডেমো টেস্ট** → Wi‑Fi → connect → read.
3. Rebuild native app with BLE plugin.
4. Flash probe with matching UUIDs / HTTP routes.
5. App: **আসল হার্ডওয়্যার** → BLE or Wi‑Fi → same UI.
