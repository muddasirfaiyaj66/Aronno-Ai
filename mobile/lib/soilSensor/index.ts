export type {
  CropSuitability,
  SoilConnectionState,
  SoilReading,
  SoilSensorDevice,
  SoilTransportKind,
} from "./types";
export { SoilSensorError } from "./types";
export { BLE_PROTOCOL, WIFI_PROTOCOL } from "./protocol";
export { recommendCropsFromSoil } from "./cropSuitability";
export {
  getSoilSensorManager,
  SoilSensorManager,
  type SensorMode,
} from "./sensorManager";
