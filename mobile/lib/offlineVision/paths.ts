/**
 * Where vision models live.
 *
 * Priority:
 *   1) Runtime override: documentDirectory/models/vision/… (user import)
 *   2) Bundled: assets/models/vision/… (shipped with the app)
 *
 * LLM / STT / TTS still download via Model Manager into documentDirectory.
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

// Metro must treat .tflite as an asset (see metro.config.js).
import bundledDisease from "@/assets/models/vision/crop_disease_int8.tflite";
import bundledTool from "@/assets/models/vision/tool_detector_int8.tflite";
import bundledClassNames from "@/assets/models/vision/class_names.json";

export const VISION_DIR = `${FileSystem.documentDirectory ?? ""}models/vision/`;

export const VISION_FILES = {
  disease: "crop_disease_int8.tflite",
  tool: "tool_detector_int8.tflite",
  classNames: "class_names.json",
} as const;

export type VisionFileKind = keyof typeof VISION_FILES;

const BUNDLED_MODULES: Record<VisionFileKind, number | object> = {
  disease: bundledDisease,
  tool: bundledTool,
  // JSON imports as a module object — we write it out as a file for parity.
  classNames: bundledClassNames,
};

export function visionFilePath(kind: VisionFileKind): string {
  return `${VISION_DIR}${VISION_FILES[kind]}`;
}

export async function visionFileExists(kind: VisionFileKind): Promise<boolean> {
  if (!FileSystem.documentDirectory) return false;
  const info = await FileSystem.getInfoAsync(visionFilePath(kind));
  if (info.exists) return true;
  // Bundled assets count as available even before first copy.
  return kind in BUNDLED_MODULES;
}

/**
 * Copy bundled vision assets into documentDirectory once so TFLite can load
 * from a real file:// path. Safe to call repeatedly.
 */
export async function ensureBundledVisionInstalled(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.makeDirectoryAsync(VISION_DIR, { intermediates: true }).catch(
    () => undefined,
  );

  for (const kind of Object.keys(VISION_FILES) as VisionFileKind[]) {
    const dest = visionFilePath(kind);
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) continue;

    if (kind === "classNames") {
      await FileSystem.writeAsStringAsync(
        dest,
        JSON.stringify(bundledClassNames),
      );
      continue;
    }

    const asset = Asset.fromModule(BUNDLED_MODULES[kind] as number);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) continue;
    await FileSystem.copyAsync({ from: uri, to: dest });
  }
}

/** Copy a file the user picked / sideloaded into the runtime vision folder. */
export async function installVisionFile(
  kind: VisionFileKind,
  sourceUri: string,
): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error("documentDirectory unavailable");
  }
  await FileSystem.makeDirectoryAsync(VISION_DIR, { intermediates: true }).catch(
    () => undefined,
  );
  const dest = visionFilePath(kind);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
