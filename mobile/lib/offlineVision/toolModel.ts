/**
 * TFLite YOLOv8n tool detector.
 * Drop `tool_detector_int8.tflite` into documentDirectory/models/vision/ after training.
 */
import * as ImageManipulator from "expo-image-manipulator";
import type { ToolResult } from "@/types/tools";
import { toolFromKbId } from "@/lib/offlineNlu/offlineMatch";
import { visionFileExists, visionFilePath } from "@/lib/offlineVision/paths";
import { markStart } from "@/lib/offline/metrics";
import kb from "@/assets/models/kb/bn_knowledge_base.json";

type TFModel = {
  run: (inputs: unknown[]) => Promise<unknown[]>;
};

let model: TFModel | null = null;

const TOOL_CLASS_IDS = kb.tools.map((t) => t.id);

export async function isToolModelAvailable(): Promise<boolean> {
  return visionFileExists("tool");
}

export async function loadToolModel(): Promise<boolean> {
  const end = markStart("vision.tool.load");
  try {
    if (!(await visionFileExists("tool"))) {
      end("missing-file");
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadTensorflowModel } = require("react-native-fast-tflite") as {
      loadTensorflowModel: (source: { url: string }) => Promise<TFModel>;
    };
    model = await loadTensorflowModel({ url: visionFilePath("tool") });
    end("ok");
    return true;
  } catch (err) {
    model = null;
    end(err instanceof Error ? err.message : "load-failed");
    return false;
  }
}

/**
 * YOLO TFLite output layout varies by export. This heuristics for the common
 * [1, N, 4+nc] or [1, 4+nc, N] shapes — refine once your export is fixed.
 */
function bestClassFromYolo(output: unknown[]): { classId: string; conf: number } | null {
  const tensor = output[0];
  if (!tensor || typeof tensor !== "object") return null;
  const data = tensor as ArrayLike<number>;
  const len = data.length;
  if (!len) return null;

  // Fallback: treat last TOOL_CLASS_IDS.length values as class scores (classifier-style export)
  if (len >= TOOL_CLASS_IDS.length && len <= TOOL_CLASS_IDS.length + 16) {
    let best = 0;
    let idx = 0;
    for (let i = 0; i < TOOL_CLASS_IDS.length; i += 1) {
      const v = Number(data[i]);
      if (v > best) {
        best = v;
        idx = i;
      }
    }
    const conf = best > 1.5 ? (best / 255) * 100 : best * 100;
    return { classId: TOOL_CLASS_IDS[idx], conf };
  }

  // Heuristic scan: find max among trailing class logits in chunks of (4 + nc)
  const nc = TOOL_CLASS_IDS.length;
  const stride = 4 + nc;
  if (len % stride === 0) {
    let bestConf = 0;
    let bestIdx = 0;
    const rows = len / stride;
    for (let r = 0; r < rows; r += 1) {
      const base = r * stride;
      for (let c = 0; c < nc; c += 1) {
        const v = Number(data[base + 4 + c]);
        const conf = v > 1.5 ? v / 255 : v;
        if (conf > bestConf) {
          bestConf = conf;
          bestIdx = c;
        }
      }
    }
    return { classId: TOOL_CLASS_IDS[bestIdx], conf: bestConf * 100 };
  }

  return null;
}

export async function detectTool(imageUri: string): Promise<ToolResult | null> {
  const end = markStart("vision.tool.infer");
  if (!model) {
    const ok = await loadToolModel();
    if (!ok || !model) {
      end("model-unavailable");
      return null;
    }
  }

  try {
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 320, height: 320 } }],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) {
      end("no-base64");
      return null;
    }
    const binary = atob(resized.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const output = await model.run([bytes]);
    const best = bestClassFromYolo(output);
    if (!best) {
      end("parse-failed");
      return null;
    }
    const result = toolFromKbId(best.classId);
    end(`class=${best.classId}`);
    return result;
  } catch (err) {
    end(err instanceof Error ? err.message : "infer-failed");
    return null;
  }
}
