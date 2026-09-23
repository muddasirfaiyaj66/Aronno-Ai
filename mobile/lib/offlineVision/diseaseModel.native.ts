/**
 * TFLite crop-disease classifier.
 * Drop `crop_disease_int8.tflite` into documentDirectory/models/vision/
 * (or bundle under assets/models/vision/) after training — see paths.ts.
 *
 * Requires `react-native-fast-tflite` + `expo-image-manipulator` and a rebuilt
 * expo-dev-client. Until then, classifyLeaf returns null and analyzing falls
 * back to KB transcript match / clear Bangla error.
 */
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import type { DiagnosisResult } from "@/types/diagnosis";
import bundledClassNames from "@/assets/models/vision/class_names.json";
import {
  diagnosisFromKbId,
} from "@/lib/offlineNlu/offlineMatch";
import { visionFileExists, visionFilePath, ensureBundledVisionInstalled } from "@/lib/offlineVision/paths";
import { logMetric, markStart } from "@/lib/offline/metrics";

type TFModel = {
  run: (inputs: unknown[]) => Promise<unknown[]>;
};

let model: TFModel | null = null;
let classNames: string[] = [...bundledClassNames];

async function loadClassNames(): Promise<void> {
  if (await visionFileExists("classNames")) {
    try {
      const raw = await FileSystem.readAsStringAsync(visionFilePath("classNames"));
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length) classNames = parsed;
    } catch {
      // keep bundled
    }
  }
}

export async function isDiseaseModelAvailable(): Promise<boolean> {
  await ensureBundledVisionInstalled().catch(() => undefined);
  return visionFileExists("disease");
}

export async function loadDiseaseModel(): Promise<boolean> {
  const end = markStart("vision.disease.load");
  try {
    await ensureBundledVisionInstalled();
    if (!(await visionFileExists("disease"))) {
      end("missing-file");
      return false;
    }
    await loadClassNames();
    // Dynamic require — package may not be linked until native rebuild
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadTensorflowModel } = require("react-native-fast-tflite") as {
      loadTensorflowModel: (source: { url: string }) => Promise<TFModel>;
    };
    model = await loadTensorflowModel({ url: visionFilePath("disease") });
    end("ok");
    return true;
  } catch (err) {
    model = null;
    end(err instanceof Error ? err.message : "load-failed");
    return false;
  }
}

function topIndex(probs: ArrayLike<number>): { idx: number; confidence: number } {
  let idx = 0;
  let best = -Infinity;
  for (let i = 0; i < probs.length; i += 1) {
    const v = Number(probs[i]);
    if (v > best) {
      best = v;
      idx = i;
    }
  }
  // uint8 outputs are 0–255; float softmax is 0–1
  const confidence = best > 1.5 ? (best / 255) * 100 : best * 100;
  return { idx, confidence };
}

export async function classifyLeaf(
  imageUri: string,
): Promise<DiagnosisResult | null> {
  const end = markStart("vision.disease.infer");
  if (!model) {
    const ok = await loadDiseaseModel();
    if (!ok || !model) {
      end("model-unavailable");
      return null;
    }
  }

  try {
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 224, height: 224 } }],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) {
      end("no-base64");
      return null;
    }

    // Feed raw bytes; TFLite INT8 models often expect uint8 HxWxC.
    // Exact preprocessing depends on your export — adjust after first field test.
    const binary = atob(resized.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const output = await model.run([bytes]);
    const probs = output[0] as ArrayLike<number>;
    const { idx, confidence } = topIndex(probs);
    const className = classNames[idx] ?? `class_${idx}`;
    const result =
      diagnosisFromKbId(className, imageUri, Math.round(confidence)) ??
      ({
        id: `offline-${className}`,
        diseaseNameBn: className,
        diseaseNameEn: className,
        confidence: Math.round(confidence),
        severity: "medium" as const,
        imageUrl: imageUri,
      } satisfies DiagnosisResult);

    end(`class=${className}`);
    logMetric("vision.disease.top", undefined, className);
    return result;
  } catch (err) {
    end(err instanceof Error ? err.message : "infer-failed");
    return null;
  }
}
