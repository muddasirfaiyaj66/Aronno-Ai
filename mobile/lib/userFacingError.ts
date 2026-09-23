/**
 * Always return short Bangla copy for UI (RetryCard, chat system bubbles).
 * Never leak English Cloudinary/RTK/env/filename strings to farmers.
 */
import { getApiError } from "@/services/api";

const FALLBACK = "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।";

const LOOKS_TECHNICAL =
  /EXPO_PUBLIC_|tflite|\.pt\b|cloudinary|fetch|network request|ECONNREFUSED|timeout|status code|undefined|null is not|TypeError|Error:|http:\/\/|https:\/\/|localhost|stack|exception|ENOENT|sqlite|llama|gguf/i;

const CODE_BN: Record<string, string> = {
  UNAUTHORIZED: "লগইন প্রয়োজন। আবার সাইন ইন করুন।",
  FORBIDDEN: "এই কাজের অনুমতি নেই।",
  NOT_FOUND: "তথ্য পাওয়া যায়নি।",
  VALIDATION: "দেওয়া তথ্য ঠিক নেই। আবার চেষ্টা করুন।",
  RATE_LIMIT: "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
  AI_UNAVAILABLE: "এআই সার্ভিস এখন কাজ করছে না। পরে চেষ্টা করুন।",
  EMAIL_UNVERIFIED: "আগে ইমেইল যাচাই করুন।",
  NETWORK: "ইন্টারনেট সংযোগ নেই বা দুর্বল। সংযোগ ঠিক করে আবার চেষ্টা করুন।",
  UPLOAD: "ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।",
  OFFLINE_DISEASE:
    "অফলাইনে রোগ শনাক্ত হয়নি। মডেল ম্যানেজার থেকে রোগ মডেল ইনস্টল করুন, অথবা রোগের নাম বলে/লিখে চেষ্টা করুন।",
  OFFLINE_TOOL:
    "অফলাইনে হাতিয়ার শনাক্ত হয়নি। মডেল ম্যানেজার থেকে হাতিয়ার মডেল ইনস্টল করুন, অথবা নাম বলে/লিখে চেষ্টা করুন।",
  OFFLINE_RECEIPT:
    "অফলাইনে রসিদ পড়তে জেমা ৩ · ৪বি (লেখা + ছবি) মডেল লাগবে। মডেল ম্যানেজার থেকে ডাউনলোড করুন, অথবা ইন্টারনেট চালু করে আবার চেষ্টা করুন।",
  LLM_NOT_READY:
    "অফলাইন এআই মডেল চালু নেই। মডেল ম্যানেজার থেকে জেমা ডাউনলোড করুন।",
  STT_NOT_READY:
    "কণ্ঠ শনাক্তকরণ মডেল নেই। লিখে পাঠান, অথবা মডেল ম্যানেজার থেকে ডাউনলোড করুন।",
  ANALYZE: "বিশ্লেষণ করা যায়নি। আবার চেষ্টা করুন।",
};

function hasBangla(s: string): boolean {
  return /[\u0980-\u09FF]/.test(s);
}

function sanitizeMessage(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (LOOKS_TECHNICAL.test(t) && !hasBangla(t)) return null;
  if (LOOKS_TECHNICAL.test(t) && hasBangla(t)) {
    // Strip technical tokens from mixed Bangla+English config messages
    return (
      t
        .replace(/EXPO_PUBLIC_[A-Z0-9_]+/g, "")
        .replace(/crop_disease_int8\.tflite/gi, "রোগ মডেল")
        .replace(/tool_detector_int8\.tflite/gi, "হাতিয়ার মডেল")
        .replace(/\s{2,}/g, " ")
        .trim() || null
    );
  }
  return t;
}

export type UserFacingContext =
  | "generic"
  | "analyze"
  | "analyze-disease"
  | "analyze-tool"
  | "analyze-receipt"
  | "upload"
  | "chat"
  | "auth"
  | "network";

/**
 * Map any thrown / RTK error into farmer-facing Bangla.
 */
export function userFacingError(
  err: unknown,
  context: UserFacingContext = "generic",
  fallback?: string,
): string {
  const api = getApiError(err);
  // Prefer specific Bangla from the API (e.g. password rule list) before code maps
  const fromApi = sanitizeMessage(api.message);
  if (fromApi && hasBangla(fromApi)) return fromApi;

  if (api.code && CODE_BN[api.code]) return CODE_BN[api.code];
  // Also accept VALIDATION_ERROR from Nest
  if (api.code === "VALIDATION_ERROR") return CODE_BN.VALIDATION;

  let rawMsg: string | undefined;
  if (err instanceof Error) rawMsg = err.message;
  else if (typeof err === "string") rawMsg = err;

  // Known English / code keys from our own throws
  if (rawMsg === "llm-not-ready") return CODE_BN.LLM_NOT_READY;
  if (rawMsg === "stt-not-ready") return CODE_BN.STT_NOT_READY;
  if (rawMsg === "OFFLINE_DISEASE") return CODE_BN.OFFLINE_DISEASE;
  if (rawMsg === "OFFLINE_TOOL") return CODE_BN.OFFLINE_TOOL;
  if (rawMsg === "OFFLINE_RECEIPT") return CODE_BN.OFFLINE_RECEIPT;
  if (rawMsg && CODE_BN[rawMsg]) return CODE_BN[rawMsg];

  const cleaned = sanitizeMessage(rawMsg);
  if (cleaned && hasBangla(cleaned)) return cleaned;

  // RTK FETCH_ERROR / network
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    ((err as { status?: unknown }).status === "FETCH_ERROR" ||
      (err as { status?: unknown }).status === "TIMEOUT_ERROR")
  ) {
    return CODE_BN.NETWORK;
  }

  switch (context) {
    case "analyze-disease":
      return CODE_BN.OFFLINE_DISEASE;
    case "analyze-tool":
      return CODE_BN.OFFLINE_TOOL;
    case "analyze-receipt":
      return CODE_BN.OFFLINE_RECEIPT;
    case "analyze":
      return CODE_BN.ANALYZE;
    case "upload":
      return CODE_BN.UPLOAD;
    case "chat":
      return CODE_BN.LLM_NOT_READY;
    case "network":
      return CODE_BN.NETWORK;
    case "auth":
      return fromApi ?? fallback ?? "লগইন করা যায়নি। আবার চেষ্টা করুন।";
    default:
      return fallback ?? FALLBACK;
  }
}

export const UserFacingMessages = CODE_BN;
