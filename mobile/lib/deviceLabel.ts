import { Platform } from "react-native";
import Constants from "expo-constants";

/** Human name for the phone this app is running on. */
export function deviceLabel(): string {
  if (Platform.OS === "android") {
    const info = Platform.constants as { Brand?: string; Model?: string };
    const name = [info.Brand, info.Model].filter(Boolean).join(" ");
    return name || "Android ফোন";
  }
  if (Platform.OS === "ios") {
    return Constants.deviceName || "iPhone";
  }
  return "এই ডিভাইস";
}
