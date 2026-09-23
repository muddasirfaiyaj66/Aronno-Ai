/**
 * Offline chat: knowledge-first answers, then grounded Gemma.
 * Prefer deterministic / KB replies; skip when no reliable facts.
 */
import { startListening } from "@/lib/offlineVoice/sttEngine";
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import {
  buildWelcomeBn,
  currentUserFirstName,
  retrieveContext,
} from "@/lib/offlineNlu/retrieve";
import { isLlmReady, streamLlmReply } from "@/lib/modelManager/llmEngine";
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

const UNKNOWN_REPLY =
  "এ বিষয়ে আমার কাছে নিশ্চিত তথ্য নেই। ফসলের রোগ, হাতিয়ার, সার-সেচ বা আবহাওয়া নিয়ে জিজ্ঞাসা করুন — অথবা পাতার ছবি তুলে স্ক্যান করুন।";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strict grounded prompt — answer only from facts; otherwise refuse.
 */
export function buildGroundedPrompt(
  userTextBn: string,
  extraContext: string[] = [],
): string {
  const name = currentUserFirstName();
  const facts = extraContext.filter(Boolean).slice(0, 6);

  return [
    "আপনি আরণ্য — বাংলাদেশের কৃষকদের জন্য নির্ভরযোগ্য কৃষি সহায়ক।",
    "শুধু নিচের «নির্ভরযোগ্য তথ্য» থেকে উত্তর দিন। তথ্য না থাকলে এক লাইনে লিখুন: এই বিষয়ে নিশ্চিত তথ্য নেই।",
    "অনুমান, অতিরঞ্জন বা ইংরেজি ট্যাগ/প্রম্পট কপি করবেন না। প্রশ্ন আবার লিখবেন না। অপ্রাসঙ্গিক অভিবাদন দেবেন না।",
    "উত্তর: ১–৩টি সংক্ষিপ্ত বাংলা বাক্য। চিকিৎসা/সারে মাত্রা শুধু তথ্যে থাকলেই বলুন।",
    name ? `কৃষকের নাম: ${name} (নিজেকে এই নাম বলবেন না)` : "",
    facts.length
      ? `নির্ভরযোগ্য তথ্য:\n- ${facts.join("\n- ")}`
      : "নির্ভরযোগ্য তথ্য: (খালি — অজানা বলুন)",
    "",
    `কৃষকের প্রশ্ন: ${userTextBn.trim()}`,
    "উত্তর:",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Strip greeting spam and identity leaks from model output. */
export function sanitizeAssistantReply(
  text: string,
  opts: { allowGreeting?: boolean } = {},
): string {
  const userName = currentUserFirstName();
  let out = text
    .replace(
      /^(?:\s*(?:কৃষক|আরণ্য|সহকারী|assistant|user|model|farmer|উত্তর)\s*[:：\-–—]\s*)+/gim,
      "",
    )
    .replace(
      /\n\s*(?:কৃষক|আরণ্য|সহকারী|assistant|user|model)\s*[:：\-–—]\s*/g,
      "\n",
    )
    .replace(/<\/?[^>]+>/g, "")
    .replace(/এই বিষয়ে নিশ্চিত তথ্য নেই[।.!?]?\s*/gi, "এই বিষয়ে নিশ্চিত তথ্য নেই। ");

  if (!opts.allowGreeting) {
    out = out.replace(
      /^(?:শুভ\s*(?:সকাল|দুপুর|বিকেল|সন্ধ্যা)|নমস্কার|হ্যালো)[^।.!?\n]{0,40}(?:আমি\s*আরণ্য[^।.!?\n]{0,40})?[।.!?]?\s*/i,
      "",
    );
    out = out.replace(
      /আমি\s*আরণ্য[।.!?]?\s*(?:কী\s*(?:জানতে\s*চান|সাহায্য\s*করব)[?؟।.!?]?\s*)?/gi,
      "",
    );
  }

  out = out.replace(/\s*\(?(?:এটা\s+)?তোমার\s+(?:নাম|পেশা)\s*নয়\)?/gi, "");
  out = out.replace(/সকালটা\s*ভালোই[।.!?]?\s*/gi, "");
  out = out.replace(/আনন্দিত হচ্ছে[।.!?]?\s*/gi, "");

  if (userName) {
    out = out.replace(
      /(?:আপনার|তোমার)?\s*নাম\s*(?:কী|কি|জানতে\s*চাই|বলুন|বলো)[?؟।.!?]?\s*/gi,
      "",
    );
    const n = escapeRegExp(userName);
    out = out.replace(
      new RegExp(`আমি\\s+${n}\\b[^.।!?\\n]{0,30}[।.!?]?`, "gi"),
      "",
    );
  }

  out = out.replace(
    /(?:হ্যালো|নমস্কার)?[,،]?\s*আমার\s+নাম\s+[^.।!?\n]{1,40}[।.!?]?/gi,
    "",
  );

  return out.replace(/\s{2,}/g, " ").replace(/\s+([।!?])/g, "$1").trim();
}

/** Fast path without LLM (greetings / time / weather only via intents). */
export function tryDeterministicReply(userTextBn: string): string | null {
  // Kept for callers; full intent runs async in runLlmTurn.
  const t = userTextBn.trim();
  if (!t) return null;
  return null;
}

export type ChatTurnHandlers = {
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
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

function looksLikeUnknown(text: string): boolean {
  return /নিশ্চিত তথ্য নেই|জানি না|জানিনা|তথ্য (?:নেই|পাইনি)|uncertain|don't know|do not know/i.test(
    text,
  );
}

/** Grounded reply for one user turn. */
export async function runLlmTurn(
  userTextBn: string,
  onTextChunk: (token: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<string> {
  const end = markStart("chat.llm");
  const cleaned = userTextBn.trim();
  if (!cleaned) {
    end("empty");
    return "";
  }

  const sessionId = await getActiveSessionId();
  const topic = await getSessionTopic(sessionId);
  const recentLines = await recentChatForPrompt(4, sessionId).catch(
    () => [] as string[],
  );

  const intent = await answerByIntent(cleaned, {
    topic,
    hasHistory: recentLines.length > 0,
  });
  if (intent) {
    if (intent.topic) await setSessionTopic(intent.topic, sessionId);
    emitAll(intent.text, onTextChunk, shouldContinue);
    end("intent");
    return intent.text;
  }

  const wantScan =
    /রোগ|দাগ|পাতা|হলুদ|পোকা|ছত্রাক|ব্লাইট|স্ক্যান|চিকিৎসা|লক্ষণ|ফসল|টমেটো|ধান|আলু|মরিচ/i.test(
      cleaned,
    ) || /হ্যাঁ|হা|ঠিক|দেখেছি|আছে/i.test(cleaned);

  const [scans, history] = await Promise.all([
    wantScan
      ? recentScansForPrompt().catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    recentChatHistoryTurns(6, sessionId).catch(
      () => [] as { role: "user" | "assistant"; text: string }[],
    ),
  ]);

  if (
    /^(হ্যাঁ|হা|জি|ঠিক|দেখেছি|আছে)[!?।.\s]*$/i.test(cleaned) &&
    recentLines.some((l) => /রোগ|টমেটো|পাতা|স্ক্যান|ছবি/i.test(l))
  ) {
    const tip =
      "নিচের ক্যামেরা আইকন দিয়ে আক্রান্ত পাতার স্পষ্ট ছবি তুলুন। স্ক্যান শেষে চিকিৎসার নির্দেশনা দেখাবে।";
    emitAll(tip, onTextChunk, shouldContinue);
    end("followup-scan");
    return tip;
  }

  const rag = retrieveContext(cleaned);
  const facts = [
    ...rag,
    ...scans,
    ...(recentLines.length ? [`আগের আলোচনা:\n${recentLines.join("\n")}`] : []),
  ];

  // No reliable facts → refuse instead of hallucinating.
  if (!rag.length && !scans.length) {
    emitAll(UNKNOWN_REPLY, onTextChunk, shouldContinue);
    end("no-facts");
    return UNKNOWN_REPLY;
  }

  if (!isLlmReady()) {
    // Still answer from KB facts without LLM when possible.
    if (rag.length) {
      const kbOnly = rag[0].slice(0, 320);
      emitAll(kbOnly, onTextChunk, shouldContinue);
      end("kb-only");
      return kbOnly;
    }
    const tip =
      "মডেল প্রস্তুত নয়। মডেল ম্যানেজার থেকে জেমা ডাউনলোড করে আবার চেষ্টা করুন।";
    emitAll(tip, onTextChunk, shouldContinue);
    end("llm-missing");
    return tip;
  }

  const prompt = buildGroundedPrompt(cleaned, facts);
  let full = "";
  let prefixBuf = "";
  let prefixDone = false;

  const feed = (token: string) => {
    if (!shouldContinue()) return;
    if (!prefixDone) {
      prefixBuf += token;
      if (prefixBuf.length < 20 && !/[\n।.!?]/.test(prefixBuf)) return;
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

  await streamLlmReply(prompt, feed, {
    userText: cleaned,
    history,
  });

  if (!prefixDone && prefixBuf) {
    const cleanedPrefix = sanitizeAssistantReply(prefixBuf);
    if (cleanedPrefix && shouldContinue()) {
      full += cleanedPrefix;
      onTextChunk(cleanedPrefix);
    }
  }

  let reply = sanitizeAssistantReply(full);
  if (!reply || looksLikeUnknown(reply)) {
    reply = UNKNOWN_REPLY;
    if (shouldContinue() && !full.includes("নিশ্চিত তথ্য")) {
      onTextChunk(reply);
    }
  }
  end("ok");
  return reply;
}

export async function persistTurn(role: "user" | "assistant", text: string) {
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
  handlers: Pick<ChatTurnHandlers, "onTextChunk" | "onDone" | "onError">,
): Promise<void> {
  const cleaned = userTextBn.trim();
  if (!cleaned) {
    handlers.onDone();
    return;
  }
  // Intent/KB can answer without LLM.
  await persistTurn("user", cleaned);
  try {
    const reply = await runLlmTurn(cleaned, handlers.onTextChunk);
    if (reply) await persistTurn("assistant", reply);
  } catch (err) {
    handlers.onError?.(err);
  } finally {
    handlers.onDone();
  }
}

export function startChatTurn(handlers: ChatTurnHandlers): () => void {
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
        const reply = await runLlmTurn(cleaned, handlers.onTextChunk);
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

export { buildWelcomeBn };
