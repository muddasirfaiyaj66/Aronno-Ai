/**
 * Chat pipeline: intent + RAG → Gemma.
 *
 * Every reply the farmer sees is written by a model — Ollama cloud
 * gemma4:31b when online (streamed token by token), on-device Gemma only when
 * the phone is offline. Intent, knowledge base, clock, weather and app data
 * are *context* for the model, never a canned answer. If no model can answer,
 * the caller gets a ChatUnavailableError and shows a notice instead.
 */
import {
  buildWelcomeBn,
  detectCropBn,
  ensureCachedWeather,
  liveSnapshot,
  retrieveContext,
} from "@/lib/offlineNlu/retrieve";
import {
  ensureLlmLoaded,
  hasInstalledLlm,
  isLlmReady,
  stopLlmReply,
  streamLlmReply,
  type LlmHistoryTurn,
} from "@/lib/modelManager/llmEngine";
import { markStart } from "@/lib/offline/metrics";
import {
  insertChatTurn,
  getChatSession,
  recentChatHistoryTurns,
  recentScansForPrompt,
  renameChatSession,
  recentChatForPrompt,
} from "@/lib/offlineDb/queries";
import { requestSyncSoon } from "@/lib/offlineDb/syncEngine";
import { gatherIntentContext } from "@/lib/offlineChat/intents";
import {
  getActiveSessionId,
  getSessionTopic,
  setSessionTopic,
  titleFromUserText,
} from "@/lib/offlineChat/sessionStore";
import { sanitizeAssistantReply } from "@/lib/offlineChat/sanitize";
import { hasCloudChatKey, streamCloudReply } from "@/lib/offlineChat/cloudChat";
import { hasGeminiKey } from "@/lib/offlineChat/cloudGemini";
import { fetchIsOnline } from "@/hooks/useIsOnline";


/** Waits at most `ms` for optional context, then answers without it. */
const CONTEXT_WAIT_MS = 2500;
function capWait<T>(work: Promise<T>, fallback: T, ms = CONTEXT_WAIT_MS): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export { sanitizeAssistantReply } from "@/lib/offlineChat/sanitize";
export { buildWelcomeBn };

/** No model could answer. `message` is a Bangla notice for the farmer (not a reply). */
export class ChatUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatUnavailableError";
  }
}

const ERR_CLOUD =
  "এখন অনলাইন সহকারীর কাছ থেকে উত্তর আসেনি। ইন্টারনেট দেখে আবার পাঠান।";
const ERR_OFFLINE_NO_MODEL =
  "ইন্টারনেট নেই, আর ফোনে অফলাইন মডেলও নেই। ইন্টারনেট চালু করুন, অথবা মডেল ম্যানেজার থেকে জেমা ডাউনলোড করুন।";
const ERR_OFFLINE_EMPTY =
  "অফলাইন মডেল এখন উত্তর দিতে পারেনি। আবার চেষ্টা করুন, অথবা ইন্টারনেট চালু করুন।";

const WEATHER_RE =
  /বৃষ্টি|আবহাওয়া|তাপমাত্রা|গরম|ঠান্ডা|কুয়াশা|ঝড়|রোদ|মেঘ|weather|rain|temp|স্প্রে|সেচ|বীজ\s*বোন|রোপণ/i;
const SCAN_RE = /স্ক্যান|ছবি|scan|আমার\s*গাছে?র?\s*(?:কী|কি)|শেষ\s*পরীক্ষা/i;
const PRICE_RE = /দাম|মূল্য|বাজার|কত\s*টাকা|price|mon\b|মণ/i;

export function buildChatPrompt(
  userTextBn: string,
  extraContext: string[] = [],
  intentLabel?: string,
  liveLines: string[] = [],
): string {
  const knowledge = Array.from(new Set(extraContext.filter(Boolean))).slice(0, 5);
  const live = Array.from(new Set(liveLines.filter(Boolean))).slice(0, 8);

  return [
    "তুমি আরণ্য। বাংলায় ২–৪টি সহজ বাক্যে উত্তর দাও। প্রশ্ন কপি করবে না। প্রশ্নে যে ফসলের কথা, শুধু সেটি নিয়েই বলবে।",
    "«অ্যাপ ডেটা» ফোনের ঘড়ি, আবহাওয়া, প্রোফাইল, সাম্প্রতিক স্ক্যান ও আগের চ্যাট থেকে নেওয়া। প্রশ্ন এগুলো নিয়ে হলে সংখ্যা ও নাম হুবহু বলো। অন্য প্রশ্নে এই তালিকা আউড়ে বলবে না। জ্ঞানভাণ্ডারে না থাকলে ওষুধের মাত্রা বা দাম বানাবে না।",
    intentLabel ? `বিষয়: ${intentLabel}` : "",
    live.length ? `অ্যাপ ডেটা:\n- ${live.join("\n- ")}` : "",
    knowledge.length ? `জ্ঞান:\n- ${knowledge.join("\n- ")}` : "",
    `প্রশ্ন: ${userTextBn.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ChatTurnHandlers = {
  onStatus?: (textBn: string) => void;
  /** Legacy: receives the final reply once. */
  onTextChunk: (token: string) => void;
  /** Streaming: receives the whole cleaned reply so far, many times. */
  onTextSet?: (text: string) => void;
  onDone: () => void;
  onError?: (err: unknown) => void;
};

export type LlmTurnOptions = {
  /** Whole cleaned reply so far (streams). When absent, the final text goes to onTextChunk once. */
  onTextSet?: (text: string) => void;
  /** Finished sentences as soon as they exist — for speaking while writing. */
  onSpeakable?: (sentences: string) => void;
};

/**
 * Hands out finished sentences from a growing reply. The first one goes out
 * as soon as it ends (the voice starts early); later ones in ~80-char batches
 * so the cloud voice isn't called once per tiny sentence.
 */
function sentenceFeeder(onSpeakable?: (s: string) => void) {
  let spoken = 0;
  let sent = 0;
  return {
    feed(text: string) {
      if (!onSpeakable || text.length <= spoken) return;
      const rest = text.slice(spoken);
      const ends = [...rest.matchAll(/[।!?\n]/g)];
      const last = ends[ends.length - 1];
      if (!last || last.index == null) return;
      const cut = last.index + 1;
      const piece = rest.slice(0, cut).trim();
      if (piece.length < (sent === 0 ? 6 : 80)) return;
      onSpeakable(piece);
      spoken += cut;
      sent += 1;
    },
    flush(text: string) {
      if (!onSpeakable) return;
      const rest = text.slice(spoken).trim();
      if (rest) onSpeakable(rest);
      spoken = text.length;
    },
  };
}

/** Reply is empty, an echo of the question, or leaked prompt scaffolding. */
function isUnusableModelText(reply: string, question: string): boolean {
  const compact = reply.replace(/\s+/g, "");
  const q = question.replace(/\s+/g, "");
  if (compact.length < 4) return true;
  if (q.length > 6 && compact.includes(q) && compact.length < q.length + 24) return true;
  return /নির্দেশনা:|প্রামাণিক তথ্য|কৃষকের প্রশ্ন|start_of_turn|im_start/i.test(reply);
}

/** Only scans that fit the question: same crop, or the farmer asks about a scan. */
function relevantScans(scans: string[], question: string): string[] {
  if (SCAN_RE.test(question)) return scans.slice(-1);
  const crop = detectCropBn(question);
  if (!crop) return [];
  return scans.filter((s) => s.includes(crop.nameBn)).slice(-1);
}

/** Intent → RAG → Gemma (cloud stream, or on-device when offline). */
export async function runLlmTurn(
  userTextBn: string,
  onTextChunk: (token: string) => void,
  shouldContinue: () => boolean = () => true,
  onStatus?: (textBn: string) => void,
  sessionIdOverride?: string,
  opts: LlmTurnOptions = {},
): Promise<string> {
  const end = markStart("chat.llm");
  const cleaned = userTextBn.trim();
  if (!cleaned) {
    end("empty");
    return "";
  }

  const sessionId = sessionIdOverride ?? (await getActiveSessionId().catch(() => ""));
  const crop = detectCropBn(cleaned);

  // Everything independent runs together — no serial waits before the model.
  const [topic, recentLines, online, scans, history] = await Promise.all([
    sessionId ? getSessionTopic(sessionId).catch(() => undefined) : undefined,
    sessionId ? recentChatForPrompt(4, sessionId).catch(() => [] as string[]) : [],
    fetchIsOnline().catch(() => false),
    recentScansForPrompt().catch(() => [] as string[]),
    sessionId
      ? recentChatHistoryTurns(6, sessionId).catch(() => [] as LlmHistoryTurn[])
      : ([] as LlmHistoryTurn[]),
    WEATHER_RE.test(cleaned)
      ? capWait(ensureCachedWeather().catch(() => null), null)
      : null,
  ]);

  const intentHit = await gatherIntentContext(cleaned, {
    topic,
    hasHistory: recentLines.length > 0,
  }).catch(() => null);
  if (intentHit?.topic && sessionId) {
    void setSessionTopic(intentHit.topic, sessionId).catch(() => undefined);
  }

  const live = liveSnapshot();
  const asked = cleaned.slice(0, 40);
  const earlierTurns = history.filter(
    (turn, index) =>
      !(index === history.length - 1 && turn.role === "user" && turn.text.startsWith(asked)),
  );
  const focus = crop
    ? [`প্রশ্নের ফসল: ${crop.nameBn}। শুধু ${crop.nameBn} নিয়ে উত্তর দাও; অন্য ফসলের রোগ বা তথ্য বলবে না।`]
    : [];
  const liveLines = [...live.lines, ...relevantScans(scans, cleaned)];
  const knowledge = [
    ...(intentHit?.facts ?? []),
    ...retrieveContext(cleaned, online ? 4 : 3),
  ];

  const feeder = sentenceFeeder(opts.onSpeakable);
  const show = (text: string) => {
    if (shouldContinue()) opts.onTextSet?.(text);
  };
  const finish = (reply: string, how: string) => {
    if (!opts.onTextSet && shouldContinue()) onTextChunk(reply);
    else show(reply);
    feeder.flush(reply);
    end(how);
    return reply;
  };

  // ── Online: Ollama cloud gemma4:31b, streamed ──────────────────────────
  if (online && hasCloudChatKey()) {
    onStatus?.("আরণ্য লিখছে…");
    // App facts are nice-to-have: on slow mobile data never hold the reply.
    const [market, appFacts] = await Promise.all([
      capWait(marketFacts(cleaned).catch(() => [] as string[]), [] as string[]),
      capWait(
        import("@/lib/offlineChat/appRag").then((mod) =>
          mod.gatherAppFacts(cleaned).catch(() => [] as string[]),
        ),
        [] as string[],
      ),
    ]);
    const facts = [...focus, ...liveLines, ...knowledge, ...market, ...appFacts];

    // Gemini already walks every free model; Ollama gets one retry.
    const attempts = hasGeminiKey() ? 1 : 2;
    for (let attempt = 0; attempt < attempts && shouldContinue(); attempt += 1) {
      let raw = "";
      let shown = "";
      const reply = await streamCloudReply(
        cleaned,
        earlierTurns,
        facts,
        (token) => {
          raw += token;
          const next = sanitizeAssistantReply(raw, { allowGreeting: true });
          if (next !== shown) {
            shown = next;
            show(next);
            feeder.feed(next);
          }
        },
        shouldContinue,
      ).catch(() => "");
      if (!shouldContinue()) {
        end("cancelled");
        return "";
      }
      const final = sanitizeAssistantReply(reply, { allowGreeting: true });
      if (final && !isUnusableModelText(final, cleaned)) {
        onStatus?.("");
        return finish(final, attempt ? "cloud-retry" : "cloud");
      }
      // Nothing usable streamed (network hiccup, cold model) → one retry.
      if (shown) show("");
      onStatus?.("আবার চেষ্টা করছি…");
    }
    onStatus?.("");
    // Cloud failed twice: on-device Gemma if it exists, else an honest error.
    if (!isLlmReady() && !(await hasInstalledLlm().catch(() => false))) {
      end("cloud-fail");
      throw new ChatUnavailableError(ERR_CLOUD);
    }
  }

  // ── Offline (or cloud failed): on-device Gemma ─────────────────────────
  if (!isLlmReady()) {
    if (!(await hasInstalledLlm().catch(() => false))) {
      end("no-model");
      throw new ChatUnavailableError(online ? ERR_CLOUD : ERR_OFFLINE_NO_MODEL);
    }
    onStatus?.("অফলাইন মডেল চালু হচ্ছে…");
    const loaded = await ensureLlmLoaded().catch(() => null);
    if (!loaded || !isLlmReady()) {
      end("llm-missing");
      throw new ChatUnavailableError(ERR_OFFLINE_EMPTY);
    }
  }
  if (!shouldContinue()) {
    end("cancelled");
    return "";
  }

  const prompt = buildChatPrompt(cleaned, [...focus, ...knowledge], intentHit?.intent, liveLines);
  let full = "";
  onStatus?.("অফলাইন AI লিখছে…");
  const watch = setInterval(() => {
    if (!shouldContinue()) void stopLlmReply();
  }, 250);
  try {
    // Small models drift mid-stream; keep the buffered, cleaned result.
    await streamLlmReply(
      prompt,
      (token) => {
        full += token;
      },
      { userText: cleaned, history: earlierTurns },
    );
  } catch (err) {
    end(err instanceof Error ? err.message : "stream-fail");
  } finally {
    clearInterval(watch);
    onStatus?.("");
  }
  if (!shouldContinue()) {
    end("cancelled");
    return "";
  }
  const reply = sanitizeAssistantReply(full, { allowGreeting: true });
  if (!reply || isUnusableModelText(reply, cleaned)) {
    end("llm-empty");
    throw new ChatUnavailableError(ERR_OFFLINE_EMPTY);
  }
  return finish(reply, intentHit ? `ok:${intentHit.intent}` : "ok");
}

function cropSlugFromText(text: string): string | undefined {
  if (/ধান|চাল|আমন|বোরো|rice/i.test(text)) return "rice";
  if (/আলু|potato/i.test(text)) return "potato";
  if (/টমেটো|tomato/i.test(text)) return "tomato";
  if (/পেঁয়াজ|onion/i.test(text)) return "onion";
  if (/ভুট্টা|corn|maize/i.test(text)) return "corn";
  if (/মসুর|ডাল|lentil/i.test(text)) return "lentil";
  return undefined;
}

/** Live market rows from the Aronno API, when the farmer asks about price. */
async function marketFacts(text: string): Promise<string[]> {
  if (!PRICE_RE.test(text)) return [];
  const { api } = await import("@/services/api");
  const { store } = await import("@/store");
  const district = store.getState().auth.user?.district?.slug;
  const request = store.dispatch(
    api.endpoints.getMarketPrices.initiate({
      cropSlug: cropSlugFromText(text),
      districtSlug: district,
    }),
  );
  const result = await Promise.race([
    request.unwrap().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
  request.unsubscribe();
  const rows = result?.markets?.slice(0, 4) ?? [];
  if (!rows.length) return [];
  return [
    "অ্যাপের বাজার ডেটা (টাকা/মণ): " +
      rows
        .map((m) => `${m.marketNameBn} (${m.district}) ${m.cropType} ${m.pricePerMon}`)
        .join("; ") +
      "। এই দামগুলোই বলো।",
  ];
}

export async function persistTurn(
  role: "user" | "assistant",
  text: string,
  sessionIdOverride?: string,
): Promise<void> {
  try {
    const sessionId = sessionIdOverride ?? (await getActiveSessionId());
    if (sessionIdOverride && !(await getChatSession(sessionId))) return;
    await insertChatTurn(role, text, undefined, sessionId);
    if (role === "user") {
      const sessTurns = await recentChatForPrompt(2, sessionId).catch(() => []);
      if (sessTurns.length <= 1) {
        await renameChatSession(sessionId, titleFromUserText(text)).catch(() => undefined);
      }
    }
    requestSyncSoon();
  } catch {
    // DB may be unavailable on first boot
  }
}

export async function replyToText(
  userTextBn: string,
  handlers: ChatTurnHandlers & { shouldContinue?: () => boolean },
): Promise<void> {
  const cleaned = userTextBn.trim();
  if (!cleaned) {
    handlers.onDone();
    return;
  }
  const shouldContinue = handlers.shouldContinue ?? (() => true);
  const sessionId = await getActiveSessionId();
  await persistTurn("user", cleaned, sessionId);
  try {
    const reply = await runLlmTurn(
      cleaned,
      handlers.onTextChunk,
      shouldContinue,
      handlers.onStatus,
      sessionId,
      { onTextSet: handlers.onTextSet },
    );
    // Stopped by the farmer → don't store a reply they never saw.
    if (reply && shouldContinue() && (await getChatSession(sessionId))) {
      await persistTurn("assistant", reply, sessionId);
    }
  } catch (err) {
    // Not saved as an Aronno reply — only shown as a notice.
    if (shouldContinue()) handlers.onError?.(err);
  } finally {
    handlers.onDone();
  }
}
