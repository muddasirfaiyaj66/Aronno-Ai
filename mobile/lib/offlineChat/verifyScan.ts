/**
 * Gemma cross-check after TFLite / KB scan — KB-first, no speculation.
 */
import { retrieveContextForLabel } from "@/lib/offlineNlu/retrieve";
import { isLlmReady, streamLlmReply } from "@/lib/modelManager/llmEngine";
import { logMetric, markStart } from "@/lib/offline/metrics";
import { sanitizeAssistantReply } from "@/lib/offlineChat/chatLoop";

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
  return sanitizeAssistantReply(out.trim());
}

function parseShort(raw: string): { status: "ok" | "uncertain"; noteBn: string } {
  const lower = raw.toLowerCase();
  const uncertain =
    lower.includes("uncertain") ||
    raw.includes("অনিশ্চিত") ||
    looksEmpty(raw);
  const line =
    raw
      .split(/[\n।]/)
      .map((s) => s.trim())
      .find((s) => s.length > 8 && !/^ok\b/i.test(s) && !/^uncertain\b/i.test(s)) ??
    raw.slice(0, 160);
  return {
    status: uncertain ? "uncertain" : "ok",
    noteBn: line.replace(/^(?:ok|uncertain)\s*[:\-–]?\s*/i, "").slice(0, 200),
  };
}

function looksEmpty(s: string) {
  return !s || /নিশ্চিত তথ্য নেই|জানি না/i.test(s);
}

export async function verifyScanResult(
  input: VerifyScanInput,
): Promise<VerifyScanResult> {
  const end = markStart("scan.verify");
  const kbFacts = retrieveContextForLabel(input.kind, input.labelId);

  // Always prefer KB text when available — 100% grounded.
  const kbDeep =
    kbFacts[0] ??
    `${input.nameBn}: স্থানীয় জ্ঞানভাণ্ডারে বিস্তারিত নেই। কৃষি অফিসের পরামর্শ নিন।`;

  if (!isLlmReady()) {
    end("kb-only");
    return {
      status: input.confidence < LOW_CONF ? "uncertain" : "ok",
      noteBn: input.confidence < LOW_CONF
        ? "আত্মবিশ্বাস কম — ছবি আবার তুলে দেখুন।"
        : "স্ক্যান সম্পন্ন।",
      deepExplanationBn: kbDeep.slice(0, 800),
    };
  }

  const shortPrompt = [
    "আপনি আরণ্য। শুধু নিচের তথ্য যাচাই করুন। অনুমান করবেন না।",
    kbFacts.length ? `তথ্য:\n${kbFacts.join("\n")}` : "তথ্য নেই।",
    `স্ক্যান ফল: ${input.nameBn} (${input.nameEn}), আত্মবিশ্বাস ${Math.round(input.confidence)}%.`,
    "উত্তর ফরম্যাট: প্রথমে ok বা uncertain, তারপর এক লাইন বাংলা নোট। তথ্য না থাকলে uncertain।",
  ].join("\n\n");

  try {
    const shortRaw = await collectCompletion(shortPrompt);
    const short = parseShort(shortRaw || "ok স্ক্যান যাচাই হয়েছে");
    logMetric("scan.verify.short", undefined, short.status);

    const needDeep =
      input.confidence < LOW_CONF || short.status === "uncertain";

    if (!needDeep) {
      end(short.status);
      return {
        status: short.status,
        noteBn: short.noteBn || "স্ক্যান যাচাই হয়েছে।",
        deepExplanationBn: kbDeep.slice(0, 800),
      };
    }

    const deepPrompt = [
      "আপনি আরণ্য। শুধু নিচের তথ্য থেকে সহজ বাংলায় ২–৪ বাক্য লিখুন।",
      "অনুমান করবেন না। তথ্যের বাইরে কিছু বলবেন না।",
      kbFacts.length ? `তথ্য:\n${kbFacts.join("\n")}` : "",
      input.kind === "disease"
        ? `বিষয়: ${input.nameBn} — লক্ষণ, চিকিৎসা ও সতর্কতা।`
        : `বিষয়: ${input.nameBn} — কী কাজে লাগে।`,
      "উত্তর:",
    ]
      .filter(Boolean)
      .join("\n\n");

    const deep = await collectCompletion(deepPrompt);
    end("deep");
    logMetric("scan.verify.deep");
    return {
      status: short.status,
      noteBn: short.noteBn,
      deepExplanationBn: (deep || kbDeep).slice(0, 800),
    };
  } catch (err) {
    end(err instanceof Error ? err.message : "verify-failed");
    return {
      status: "ok",
      noteBn: "স্ক্যান সম্পন্ন।",
      deepExplanationBn: kbDeep.slice(0, 800),
    };
  }
}
