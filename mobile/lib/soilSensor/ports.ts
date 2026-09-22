import type { SoilReading, SoilSensorDevice, SoilTransportKind } from "./types";

export type SoilTransport = {
  readonly kind: SoilTransportKind;
  /** Soft label for UI */
  readonly labelBn: string;
  readonly supportsScan: boolean;

  isAvailable(): Promise<boolean>;
  /** BLE: scan nearby. WiFi: optional — often empty; user enters IP. */
  scan(onDevice: (device: SoilSensorDevice) => void): Promise<void>;
  stopScan(): Promise<void>;
  connect(device: SoilSensorDevice): Promise<void>;
  disconnect(): Promise<void>;
  read(): Promise<SoilReading>;
  getConnected(): SoilSensorDevice | null;
};
