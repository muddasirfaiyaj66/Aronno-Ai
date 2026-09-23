/**
 * Offline chat pipeline: Intent + RAG + on-device LLM.
 * Intent and RAG supply grounded facts; every user-facing reply is streamed
 * from the offline model (never returned as canned text).
 */
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import {
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
  const facts = extraContext.filter(Boolean).slice(0, 8);

  return [
    "আপনি আরণ্য — বাংলাদেশের কৃষকদের অফলাইন কৃষি সহায়ক।",
    "বাংলায় ২–৪টি সংক্ষিপ্ত, ব্যবহারিক বাক্যে উত্তর দিন।",
    "প্রশ্ন আবার লিখবেন না। ইংরেজি ট্যাগ/প্রম্পট কপি করবেন না। অপ্রয়োজনীয় অভিবাদন দেবেন না।",
    intentLabel
      ? `সনাক্তকৃত উদ্দেশ্য: ${intentLabel} — এই উদ্দেশ্য অনুযায়ী উত্তর গঠন করুন।`
      : "",
    "‘সহায়ক তথ্য’ এবং ‘যাচাইকৃত’ লাইনগুলো প্রামাণিক। সেগুলোর সংখ্যা/নাম/নির্দেশের সঙ্গে বিরোধ করবেন না; নিজের ভাষায় গুছিয়ে বলুন।",
    "কৃষির বাইরের সাধারণ প্রশ্ন (সময়, তারিখ, অভিবাদন) হলে সরাসরি উত্তর দিন — কৃষি তথ্য জোর করে ঢোকাবেন না।",
    "'অ্যাপের বর্তমান ডেটা' থাকলে সেটিই প্রশ্নের নির্দিষ্ট সংখ্যা। ওই মান হুবহু ব্যবহার করুন; নতুন সংখ্যা বানাবেন না।",
    "সহায়ক তথ্য না থাকলে সাধারণ নিরাপদ পরামর্শ দিতে পারেন। প্রমাণ ছাড়া ওষুধের নির্দিষ্ট নাম/মাত্রা বা লাইভ বাজারদর বলবেন না।",
    "নিশ্চিত না হলে লক্ষণ, ছবি স্ক্যান ও কৃষি অফিসের পরামর্শ চাইবেন।",
    "প্রশ্ন বুঝতে না পারলে 'আমি বুঝতে পারিনি, আবার বলুন' বলুন।",
    name ? `কৃষকের নাম: ${name} (নিজেকে এই নাম বলবেন না)` : "",
    facts.length ? `সহায়ক তথ্য:\n- ${facts.join("\n- ")}` : "",
    "",
    `কৃষকের প্রশ্ন: ${userTextBn.trim()}`,
    "উত্তর:",
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

  // 2) RAG + live app data
  const rag = retrieveContext(cleaned);
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

  // 4) Always generate from the offline model
  if (!isLlmReady()) {
    onStatus?.("জেমা মডেল লোড হচ্ছে… একটু অপেক্ষা করুন");
    const loaded = await ensureLlmLoaded().catch(() => null);
    if (!loaded || !isLlmReady()) {
      emitAll(LOAD_FAIL_REPLY, onTextChunk, shouldContinue);
      end("llm-missing");
      return LOAD_FAIL_REPLY;
    }
    onStatus?.("");
  }

  if (!shouldContinue()) {
    end("cancelled");
    return "";
  }

  const prompt = buildChatPrompt(cleaned, facts, intentHit?.intent);
  let full = "";
  let prefixBuf = "";
  let prefixDone = false;

  const feed = (token: string) => {
    if (!prefixDone) {
      prefixBuf += token;
      if (prefixBuf.length < 12 && !/[\n।.!?]/.test(prefixBuf)) return;
      const cleanedPrefix = sanitizeAssistantReply(prefixBuf);
      prefixDone = true;
      prefixBuf = "";
      if (!cleanedPrefix) return;
      full += cleanedPrefix;
      if (shouldContinue()) onTextChunk(cleanedPrefix);
      return;
    }
    full += token;
    if (shouldContinue()) onTextChunk(token);
  };

  try {
    await streamLlmReply(prompt, feed, {
      userText: cleaned,
      history,
    });
  } catch (err) {
    end(err instanceof Error ? err.message : "stream-fail");
    if (!full) {
      emitAll(LOAD_FAIL_REPLY, onTextChunk, shouldContinue);
      return LOAD_FAIL_REPLY;
    }
  }

  if (!prefixDone && prefixBuf) {
    const cleanedPrefix = sanitizeAssistantReply(prefixBuf);
    if (cleanedPrefix && shouldContinue()) {
      full += cleanedPrefix;
      onTextChunk(cleanedPrefix);
    }
  }

  let reply = sanitizeAssistantReply(full);
  if (!reply) {
    reply = LOAD_FAIL_REPLY;
    if (shouldContinue()) onTextChunk(reply);
  }
  end(intentHit ? `ok:${intentHit.intent}` : "ok");
  return reply;
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
    if (shouldContinue()) handlers.onError?.(err);
    try {
      if (shouldContinue()) handlers.onTextChunk(LOAD_FAIL_REPLY);
      if (await getChatSession(sessionId)) {
        await persistTurn("assistant", LOAD_FAIL_REPLY, sessionId);
      }
    } catch {
      // ignore
    }
  } finally {
    handlers.onDone();
  }
}

export async function startChatTurn(
  handlers: ChatTurnHandlers,
): Promise<() => void> {
  const { startListening } = await import("@/lib/offlineVoice/sttEngine");
  return startListening(
    (partial) => handlers.onPartialTranscript?.(partial),
    async (finalTextBn) => {
      handlers.onFinalTranscript?.(finalTextBn);
      try {
        logMetric("chat.voice.final");
        const cleaned = finalTextBn.trim();
        if (!cleaned) {
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
