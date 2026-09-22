/**
 * Where to drop trained / downloaded models.
 *
 * Vision (you train → copy here or into documentDirectory):
 *   1) Bundled:  mobile/assets/models/vision/crop_disease_int8.tflite
 *                mobile/assets/models/vision/tool_detector_int8.tflite
 *                mobile/assets/models/vision/class_names.json
 *   2) Runtime:  FileSystem.documentDirectory + "models/vision/..."
 *
 * LLM / STT / TTS: Model Manager downloads into documentDirectory/models/<id>/
 */
import * as FileSystem from "expo-file-system/legacy";

export const VISION_DIR = `${FileSystem.documentDirectory ?? ""}models/vision/`;

export const VISION_FILES = {
  disease: "crop_disease_int8.tflite",
  tool: "tool_detector_int8.tflite",
  classNames: "class_names.json",
} as const;

export function visionFilePath(
  kind: keyof typeof VISION_FILES,
): string {
  return `${VISION_DIR}${VISION_FILES[kind]}`;
}

export async function visionFileExists(
  kind: keyof typeof VISION_FILES,
): Promise<boolean> {
  if (!FileSystem.documentDirectory) return false;
  const info = await FileSystem.getInfoAsync(visionFilePath(kind));
  return info.exists;
}

/** Copy a file the user picked / sideloaded into the runtime vision folder. */
export async function installVisionFile(
  kind: "disease" | "tool" | "classNames",
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
