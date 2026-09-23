/**
 * Sideload trained TFLite vision models from the device file picker.
 */
import * as DocumentPicker from "expo-document-picker";
import {
  ensureBundledVisionInstalled,
  installVisionFile,
  visionFileExists,
  VISION_FILES,
} from "@/lib/offlineVision/paths";
import { logMetric } from "@/lib/offline/metrics";

export type VisionKind = "disease" | "tool" | "classNames";

export async function pickAndInstallVision(
  kind: VisionKind,
): Promise<{ ok: boolean; path?: string; messageBn: string }> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: kind === "classNames" ? ["application/json", "text/plain", "*/*"] : ["*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) {
    return { ok: false, messageBn: "কোনো ফাইল বেছে নেওয়া হয়নি।" };
  }
  const asset = picked.assets[0];
  const name = (asset.name ?? "").toLowerCase();
  if (kind !== "classNames" && !name.endsWith(".tflite") && !name.endsWith(".bin")) {
    return {
      ok: false,
      messageBn: `একটি ${VISION_FILES[kind]} ফাইল বেছে নিন।`,
    };
  }
  try {
    const path = await installVisionFile(kind, asset.uri);
    logMetric("vision.import", undefined, kind);
    return {
      ok: true,
      path,
      messageBn:
        kind === "disease"
          ? "রোগ মডেল ইনস্টল হয়েছে।"
          : kind === "tool"
            ? "হাতিয়ার মডেল ইনস্টল হয়েছে।"
            : "ক্লাস নাম ফাইল ইনস্টল হয়েছে।",
    };
  } catch {
    return { ok: false, messageBn: "ইনস্টল ব্যর্থ। আবার চেষ্টা করুন।" };
  }
}

export async function visionInstallStatus(): Promise<{
  disease: boolean;
  tool: boolean;
  classNames: boolean;
}> {
  await ensureBundledVisionInstalled().catch(() => undefined);
  return {
    disease: await visionFileExists("disease"),
    tool: await visionFileExists("tool"),
    classNames: await visionFileExists("classNames"),
  };
}
