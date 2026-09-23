/**
 * Gemma cross-check after TFLite / KB scan.
 * Always short-verify when LLM ready; deep pass if confidence < 70% or uncertain.
 */
import { retrieveContextForLabel } from "@/lib/offlineNlu/retrieve";
import { buildGroundedPrompt } from "@/lib/offlineChat/chatLoop";
import { isLlmReady, streamLlmReply } from "@/lib/modelManager/llmEngine";
import { logMetric, markStart } from "@/lib/offline/metrics";

const LOW_CONF = 70;

export type VerifyScanInput = {
  kind: "disease" | "tool";
  labelId: string;
  nameBn: string;
  nameEn: string;
  confidence: number;
};

export type VerifyScanResult = {
  status: "ok" | "uncertain" | "skipped";
  noteBn: string;
  deepExplanationBn?: string;
};

async function collectCompletion(prompt: string): Promise<string> {
  let out = "";
  await streamLlmReply(prompt, (token) => {
    out += token;
  });
  return out.trim();
}

function parseShort(raw: string): { status: "ok" | "uncertain"; noteBn: string } {
  const lower = raw.toLowerCase();
  const uncertain =
    lower.includes("uncertain") ||
    raw.includes("অনিশ্চিত") ||
    lower.includes('"status": "uncertain"') ||
    lower.includes("status: uncertain");
  const line =
    raw
      .split(/[\n।]/)
      .map((s) => s.trim())
      .find((s) => s.length > 8 && !s.startsWith("{")) ?? raw.slice(0, 160);
  return {
    status: uncertain ? "uncertain" : "ok",
    noteBn: line.slice(0, 200),
  };
}

export async function verifyScanResult(
  input: VerifyScanInput,
): Promise<VerifyScanResult> {
  const end = markStart("scan.verify");
  if (!isLlmReady()) {
    end("llm-missing");
    return { status: "skipped", noteBn: "" };
  }

  const kbFacts = retrieveContextForLabel(input.kind, input.labelId);
  const shortPrompt = [
    "তুমি আরণ্য। সংক্ষেপে যাচাই করো।",
    kbFacts.length ? `তথ্য:\n${kbFacts.join("\n")}` : "",
    `মডেল বলেছে: ${input.nameBn} (${input.nameEn}), আত্মবিশ্বাস ${Math.round(input.confidence)}%.`,
    `এক লাইনে যাচাই করো। প্রথমে লিখো ok অথবা uncertain, তারপর সংক্ষিপ্ত বাংলা নোট।`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const shortRaw = await collectCompletion(shortPrompt);
    const short = parseShort(shortRaw || "ok যাচাই সম্পন্ন");
    logMetric("scan.verify.short", undefined, short.status);

    const needDeep =
      input.confidence < LOW_CONF || short.status === "uncertain";

    if (!needDeep) {
      end(short.status);
      return { status: short.status, noteBn: short.noteBn };
    }

    const deepPrompt = buildGroundedPrompt(
      input.kind === "disease"
        ? `এই রোগ (${input.nameBn}) সম্পর্কে সহজ বাংলায় লক্ষণ, চিকিৎসা ও সতর্কতা বলো। আত্মবিশ্বাস ${Math.round(input.confidence)}%.`
        : `এই হাতিয়ার (${input.nameBn}) কী কাজে লাগে সংক্ষেপে বাংলায় বলো।`,
      kbFacts,
    );
    const deep = await collectCompletion(deepPrompt);
    end("deep");
    logMetric("scan.verify.deep");
    return {
      status: short.status,
      noteBn: short.noteBn,
      deepExplanationBn: deep.slice(0, 800),
    };
  } catch (err) {
    end(err instanceof Error ? err.message : "verify-failed");
    return { status: "skipped", noteBn: "" };
  }
}
