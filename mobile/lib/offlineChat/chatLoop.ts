/**
 * Offline chat: load Gemma and stream real model replies.
 * Fast intents only for greetings / time / thanks (no farming canned text).
 * RAG facts are optional grounding — model still answers when facts are thin.
 */
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import {
  buildWelcomeBn,
  currentUserFirstName,
  retrieveContext,
  seasonTipBn,
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
  recentChatForPrompt,
  recentChatHistoryTurns,
  recentScansForPrompt,
  renameChatSession,
} from "@/lib/offlineDb/queries";
import { requestSyncSoon } from "@/lib/offlineDb/syncEngine";
import { answerByIntent } from "@/lib/offlineChat/intents";
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

/** Only short social turns skip the model — farming always goes to Gemma. */
const FAST_INTENT_ONLY =
  /^(?:হ্যালো+|হেলো|হাই|hello|hi|hey|নমস্কার|আসসালামু\s*আলাইকুম|সালাম|শুভ\s*(?:সকাল|দুপুর|বিকেল|সন্ধ্যা)|ধন্যবাদ|থ্যাংক|thank|বিদায়|আল্লাহ\s*হাফেজ|bye|কয়টা\s*বাজে|সময়\s*কত|তারিখ|কেমন\s*আছ)/i;

export function buildChatPrompt(
  userTextBn: string,
  extraContext: string[] = [],
): string {
  const name = currentUserFirstName();
  const facts = extraContext.filter(Boolean).slice(0, 5);

  return [
    "আপনি আরণ্য — বাংলাদেশের কৃষকদের অফলাইন কৃষি সহায়ক।",
    "বাংলায় ২–৪টি সংক্ষিপ্ত, ব্যবহারিক বাক্যে উত্তর দিন।",
    "প্রশ্ন আবার লিখবেন না। ইংরেজি ট্যাগ/প্রম্পট কপি করবেন না। অপ্রয়োজনীয় অভিবাদন দেবেন না।",
    "ফসল, রোগ, সার, সেচ, হাতিয়ার, আবহাওয়া — যা জানেন সাহায্য করুন। নিশ্চিত না হলে সাধারণ সতর্ক পরামর্শ দিন এবং স্ক্যান/কৃষি অফিসের কথা বলুন।",
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
  /** Optional: “মডেল লোড হচ্ছে…” while ensureLlmLoaded runs */
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

/** One chat turn: load Gemma if needed, then stream model tokens. */
export async function runLlmTurn(
  userTextBn: string,
  onTextChunk: (token: string) => void,
  shouldContinue: () => boolean = () => true,
  onStatus?: (textBn: string) => void,
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
    sessionId = await getActiveSessionId();
    topic = await getSessionTopic(sessionId);
    recentLines = await recentChatForPrompt(4, sessionId).catch(() => []);
  } catch {
    // continue
  }

  // Fast path: greetings / time only — not farming.
  if (FAST_INTENT_ONLY.test(cleaned) && cleaned.length < 48) {
    try {
      const intent = await answerByIntent(cleaned, {
        topic,
        hasHistory: recentLines.length > 0,
      });
      if (intent) {
        if (intent.topic && sessionId) {
          await setSessionTopic(intent.topic, sessionId).catch(() => undefined);
        }
        emitAll(intent.text, onTextChunk, shouldContinue);
        end("intent");
        return intent.text;
      }
    } catch {
      // fall through to model
    }
  }

  const wantScan =
    /রোগ|দাগ|পাতা|হলুদ|পোকা|ছত্রাক|ব্লাইট|স্ক্যান|চিকিৎসা|লক্ষণ|ফসল|টমেটো|ধান|আলু|মরিচ/i.test(
      cleaned,
    );

  const [scans, history] = await Promise.all([
    wantScan
      ? recentScansForPrompt().catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    sessionId
      ? recentChatHistoryTurns(6, sessionId).catch(() => [] as LlmHistoryTurn[])
      : Promise.resolve([] as LlmHistoryTurn[]),
  ]);

  let rag = retrieveContext(cleaned);
  if (!rag.length) {
    rag = [seasonTipBn()];
  }

  const facts = [
    ...rag,
    ...scans,
    ...(recentLines.length ? [`আগের আলোচনা:\n${recentLines.slice(-2).join("\n")}`] : []),
  ];

  // Load the real Gemma model — this is what the farmer asked for.
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

  const prompt = buildChatPrompt(cleaned, facts);
  let full = "";
  let prefixBuf = "";
  let prefixDone = false;

  const feed = (token: string) => {
    if (!shouldContinue()) return;
    if (!prefixDone) {
      prefixBuf += token;
      if (prefixBuf.length < 12 && !/[\n।.!?]/.test(prefixBuf)) return;
      const cleanedPrefix = sanitizeAssistantReply(prefixBuf);
      prefixDone = true;
      prefixBuf = "";
      if (!cleanedPrefix) return;
      full += cleanedPrefix;
      onTextChunk(cleanedPrefix);
      return;
    }
    full += token;
    onTextChunk(token);
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
  end("ok");
  return reply;
}

export async function persistTurn(
  role: "user" | "assistant",
  text: string,
): Promise<void> {
  try {
    const sessionId = await getActiveSessionId();
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
  >,
): Promise<void> {
  const cleaned = userTextBn.trim();
  if (!cleaned) {
    handlers.onDone();
    return;
  }
  await persistTurn("user", cleaned);
  try {
    const reply = await runLlmTurn(
      cleaned,
      handlers.onTextChunk,
      () => true,
      handlers.onStatus,
    );
    if (reply) await persistTurn("assistant", reply);
  } catch (err) {
    handlers.onError?.(err);
    try {
      handlers.onTextChunk(LOAD_FAIL_REPLY);
      await persistTurn("assistant", LOAD_FAIL_REPLY);
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
        await persistTurn("user", cleaned);
        const reply = await runLlmTurn(
          cleaned,
          handlers.onTextChunk,
          () => true,
          handlers.onStatus,
        );
        if (reply) {
          await persistTurn("assistant", reply);
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
