/**
 * Offline chat pipeline: Intent + RAG + on-device LLM.
 * Intent and RAG supply grounded facts; every user-facing reply is streamed
 * from the offline model (never returned as canned text).
 */
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import {
  buildSessionFacts,
  buildWelcomeBn,
  cachedWeather,
  currentUserFirstName,
  retrieveContext,
} from "@/lib/offlineNlu/retrieve";
import {
  ensureLlmLoaded,
  isLlmReady,
  streamLlmReply,
  type LlmHistoryTurn,
} from "@/lib/modelManager/llmEngine";
import { logMetric, markStart } from "@/lib/offline/metrics";
import {
  insertChatTurn,
  getChatSession,
  recentChatForPrompt,
  recentChatHistoryTurns,
  recentScansForPrompt,
  renameChatSession,
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
import { fetchIsOnline } from "@/hooks/useIsOnline";

export { sanitizeAssistantReply } from "@/lib/offlineChat/sanitize";
export { buildWelcomeBn };

const LOAD_FAIL_REPLY =
  "জেমা মডেল এখন চালু নেই। মডেল ম্যানেজার খুলে ডাউনলোড করা জেমাতে «চালু করুন» চাপুন, তারপর এখানে আবার জিজ্ঞাসা করুন।";

/** Only send earlier chat turns when the farmer explicitly refers to them. */
const WANTS_SESSION_CONTEXT_RE =
  /আগের|পূর্বের|সেই|সেটা|ওটা|এটা|তারপর|আবার|হ্যাঁ|ঠিক আছে|বললাম|ওই রোগ|ওই ফসল|আগের কথা/i;

const WANTS_WEATHER_CONTEXT_RE =
  /বৃষ্টি|আবহাওয়া|তাপমাত্রা|টেম্পারেচার|কুয়াশা|ঝড়|রোদ|রৌদ্র|\b(?:weather|rain|temp|temperature|humidity)\b|স্প্রে|সেচ/i;

const WANT_SCAN_RE =
  /রোগ|দাগ|পাতা|হলুদ|পোকা|ছত্রাক|ব্লাইট|স্ক্যান|চিকিৎসা|লক্ষণ|ফসল|টমেটো|ধান|আলু|মরিচ/i;

export function buildChatPrompt(
  userTextBn: string,
  extraContext: string[] = [],
  intentLabel?: string,
): string {
  const name = currentUserFirstName();
  const facts = Array.from(new Set(extraContext.filter(Boolean))).slice(0, 6);

  return [
    "তুমি আরণ্য। বাংলায় ২–৩টি সহজ বাক্যে উত্তর দাও। প্রশ্ন কপি করবে না।",
    intentLabel ? `বিষয়: ${intentLabel}` : "",
    name ? `কৃষক: ${name}` : "",
    facts.length ? `তথ্য:\n- ${facts.join("\n- ")}` : "",
    `প্রশ্ন: ${userTextBn.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** @deprecated use buildChatPrompt — kept for imports */
export function buildGroundedPrompt(
  userTextBn: string,
  extraContext: string[] = [],
): string {
  return buildChatPrompt(userTextBn, extraContext);
}

export type ChatTurnHandlers = {
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onStatus?: (textBn: string) => void;
  onTextChunk: (token: string) => void;
  onDone: () => void;
  onError?: (err: unknown) => void;
};

function emitAll(
  text: string,
  onTextChunk: (token: string) => void,
  shouldContinue: () => boolean,
) {
  if (text && shouldContinue()) onTextChunk(text);
  return text;
}

/** Intent → RAG → offline LLM stream. */
export async function runLlmTurn(
  userTextBn: string,
  onTextChunk: (token: string) => void,
  shouldContinue: () => boolean = () => true,
  onStatus?: (textBn: string) => void,
  sessionIdOverride?: string,
): Promise<string> {
  const end = markStart("chat.llm");
  const cleaned = userTextBn.trim();
  if (!cleaned) {
    end("empty");
    return "";
  }

  let sessionId = "";
  let topic: Awaited<ReturnType<typeof getSessionTopic>>;
  let recentLines: string[] = [];

  try {
    sessionId = sessionIdOverride ?? (await getActiveSessionId());
    topic = await getSessionTopic(sessionId);
    recentLines = await recentChatForPrompt(4, sessionId).catch(() => []);
  } catch {
    // continue
  }

  // 1) Intent — grounded facts only (never the final reply)
  const intentHit = await gatherIntentContext(cleaned, {
    topic,
    hasHistory: recentLines.length > 0,
  }).catch(() => null);

  if (intentHit?.topic && sessionId) {
    await setSessionTopic(intentHit.topic, sessionId).catch(() => undefined);
  }

  const wantScan = WANT_SCAN_RE.test(cleaned);
  const wantsSessionContext = WANTS_SESSION_CONTEXT_RE.test(cleaned);

  const [scans, history] = await Promise.all([
    wantScan
      ? recentScansForPrompt().catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    sessionId && wantsSessionContext
      ? recentChatHistoryTurns(6, sessionId).catch(() => [] as LlmHistoryTurn[])
      : Promise.resolve([] as LlmHistoryTurn[]),
  ]);

  const online = await fetchIsOnline();

  // 2) RAG + live app data. Cloud Gemma can use a wider slice of the knowledge base.
  const rag = retrieveContext(cleaned, online ? 8 : 4);
  const weather =
    !intentHit || intentHit.intent !== "weather"
      ? WANTS_WEATHER_CONTEXT_RE.test(cleaned)
        ? cachedWeather()
        : null
      : null;
  const appData = weather
    ? [
        `অ্যাপের বর্তমান ডেটা — স্থান: ${weather.locationBn || "অজানা"}; তাপমাত্রা: ${weather.tempC}°সে; অবস্থা: ${weather.conditionBn}; আর্দ্রতা: ${weather.humidity}%; বাতাস: ${weather.windKph} কিমি/ঘণ্টা; বৃষ্টিপাত: ${weather.precipitationMm} মিমি; বৃষ্টির সম্ভাবনা: ${weather.precipProb}%. এই ডেটার সংখ্যাগুলোই ব্যবহার করুন।`,
      ]
    : [];

  // 3) Merge: intent facts first (precise), then RAG, scans, history
  const facts = [
    ...(intentHit?.facts ?? []),
    ...appData,
    ...rag,
    ...scans,
    ...(wantsSessionContext && recentLines.length
      ? [`আগের আলোচনা:\n${recentLines.slice(-2).join("\n")}`]
      : []),
  ];

  if (online) {
    onStatus?.("ক্লাউড জেমা উত্তর দিচ্ছে…");
    const market = await marketFacts(cleaned).catch(() => [] as string[]);
    const cloud = await cloudReply(cleaned, history, [
      ...buildSessionFacts(),
      ...facts,
      ...market,
    ]).catch(() => "");
    const cloudText = sanitizeAssistantReply(cloud);
    if (cloudText && !isUnusableModelText(cloudText, cleaned)) {
      emitAll(cloudText, onTextChunk, shouldContinue);
      end("cloud");
      return cloudText;
    }
  }

  // Offline Gemma when the cloud model is unavailable.
  if (!isLlmReady()) {
    onStatus?.("জেমা মডেল লোড হচ্ছে… একটু অপেক্ষা করুন");
    const loaded = await ensureLlmLoaded().catch(() => null);
    if (!loaded || !isLlmReady()) {
      const spoken =
        socialFallback(cleaned) || spokenFromFacts(facts) || LOAD_FAIL_REPLY;
      emitAll(spoken, onTextChunk, shouldContinue);
      end("llm-missing");
      return spoken;
    }
    onStatus?.("");
  }

  if (!shouldContinue()) {
    end("cancelled");
    return "";
  }

  const prompt = buildChatPrompt(cleaned, facts, intentHit?.intent);
  let full = "";
  onStatus?.("জেমা উত্তর লিখছে…");

  try {
    await streamLlmReply(prompt, (token) => {
      full += token;
    }, {
      userText: cleaned,
      history,
    });
  } catch (err) {
    end(err instanceof Error ? err.message : "stream-fail");
  }

  let reply = sanitizeAssistantReply(full);
  if (!reply || isUnusableModelText(reply, cleaned)) {
    reply = socialFallback(cleaned) || spokenFromFacts(facts) || LOAD_FAIL_REPLY;
  }
  emitAll(reply, onTextChunk, shouldContinue);
  end(intentHit ? `ok:${intentHit.intent}` : "ok");
  return reply;
}

async function cloudReply(
  text: string,
  history: LlmHistoryTurn[],
  facts: string[],
): Promise<string> {
  const { replyWithCloudGemma } = await import("@/lib/offlineChat/cloudGemma");
  return replyWithCloudGemma(text, history, facts);
}

const PRICE_RE = /দাম|মূল্য|বাজার|কত\s*টাকা|price|mon\b|মণ/i;

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
  const result = await store
    .dispatch(
      api.endpoints.getMarketPrices.initiate({
        cropSlug: cropSlugFromText(text),
        districtSlug: district,
      }),
    )
    .unwrap()
    .catch(() => null);
  const rows = result?.markets?.slice(0, 4) ?? [];
  if (!rows.length) return [];
  return [
    "অ্যাপের বাজার ডেটা (টাকা/মণ): " +
      rows
        .map(
          (m) =>
            `${m.marketNameBn} (${m.district}) ${m.cropType} ${m.pricePerMon}`,
        )
        .join("; ") +
      "। এই দামগুলোই বলো।",
  ];
}

function socialFallback(text: string): string | null {
  const t = text.trim();
  if (/^(?:hi|hai|hello|hey|হ্যালো|নমস্কার|হাই)[\s!?.]*$/i.test(t)) {
    return "নমস্কার। ফসল, রোগ, সার বা আবহাওয়া — কী জানতে চান?";
  }
  if (/obosta|অবস্থা|কেমন\s*আছ/i.test(t) && t.length < 40) {
    return "ভালো আছি। আপনার ফসলে কোনো সমস্যা দেখা দিয়েছে?";
  }
  if (/^(?:kire|কিরে|oi|ওই)[\s!?.]*$/i.test(t)) {
    return "বলুন — কী জানতে চান?";
  }
  return null;
}

function isUnusableModelText(reply: string, question: string): boolean {
  const compact = reply.replace(/\s+/g, "");
  const q = question.replace(/\s+/g, "");
  if (compact.length < 8) return true;
  if (q.length > 6 && compact.includes(q) && compact.length < q.length + 24) return true;
  return /নির্দেশনা:|প্রামাণিক তথ্য|কৃষকের প্রশ্ন|start_of_turn|im_start/i.test(reply);
}

/** When Gemma echoes or fails, still give the farmer the grounded facts. */
function spokenFromFacts(facts: string[]): string {
  const lines = facts
    .map((f) =>
      f
        .replace(/^(?:উদ্দেশ্য|নির্দেশ)\s*[:：]\s*/u, "")
        .replace(/^যাচাইকৃত[^:：]{0,24}[:：]\s*/u, "")
        .replace(/^অ্যাপের বর্তমান ডেটা\s*[—-]\s*/u, "")
        .trim(),
    )
    .filter(
      (f) =>
        f.length > 12 &&
        !/^(?:উদ্দেশ্য|নির্দেশ|অ্যাপ ডেটা)/.test(f) &&
        !/সংক্ষিপ্ত অভিবাদন|জিজ্ঞাসা নিন|প্রশ্নের উত্তর দিতে পারছি না/.test(f),
    );
  return lines.slice(0, 3).join(" ").replace(/\s+/g, " ").slice(0, 520);
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
        await renameChatSession(sessionId, titleFromUserText(text)).catch(
          () => undefined,
        );
      }
    }
    requestSyncSoon();
  } catch {
    // DB may be unavailable on first boot
  }
}

export async function replyToText(
  userTextBn: string,
  handlers: Pick<
    ChatTurnHandlers,
    "onTextChunk" | "onDone" | "onError" | "onStatus"
  > & {
    shouldContinue?: () => boolean;
  },
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
    );
    if (reply && (await getChatSession(sessionId))) {
      await persistTurn("assistant", reply, sessionId);
    }
  } catch (err) {
    try {
      if (shouldContinue()) handlers.onTextChunk(LOAD_FAIL_REPLY);
      if (await getChatSession(sessionId)) {
        await persistTurn("assistant", LOAD_FAIL_REPLY, sessionId);
      }
    } catch {
      if (shouldContinue()) handlers.onError?.(err);
    }
  } finally {
    handlers.onDone();
  }
}

export async function startChatTurn(
  handlers: ChatTurnHandlers,
): Promise<() => void> {
  const { cleanSttTranscript, startListening } = await import(
    "@/lib/offlineVoice/sttEngine"
  );
  return startListening(
    (partial) => handlers.onPartialTranscript?.(partial),
    async (finalTextBn) => {
      const cleaned = cleanSttTranscript(finalTextBn).trim();
      handlers.onFinalTranscript?.(cleaned);
      try {
        logMetric("chat.voice.final");
        if (!cleaned || cleaned.length < 2) {
          handlers.onDone();
          return;
        }
        const sessionId = await getActiveSessionId();
        await persistTurn("user", cleaned, sessionId);
        const reply = await runLlmTurn(
          cleaned,
          handlers.onTextChunk,
          () => true,
          handlers.onStatus,
          sessionId,
        );
        if (reply && (await getChatSession(sessionId))) {
          await persistTurn("assistant", reply, sessionId);
          void streamOffline(reply);
        }
      } catch (err) {
        handlers.onError?.(err);
      } finally {
        handlers.onDone();
      }
    },
  );
}
