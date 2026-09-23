/**
 * Offline chat: grounded Gemma + deterministic handlers for greetings/time/weather.
 * Short recent-turn context for follow-ups («হ্যাঁ»).
 */
import { startListening } from "@/lib/offlineVoice/sttEngine";
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import {
  buildSessionFacts,
  buildWelcomeBn,
  currentUserFirstName,
  retrieveContext,
  timeReplyBn,
  weatherReplyBn,
} from "@/lib/offlineNlu/retrieve";
import { isLlmReady, streamLlmReply } from "@/lib/modelManager/llmEngine";
import { logMetric, markStart } from "@/lib/offline/metrics";
import {
  insertChatTurn,
  recentChatForPrompt,
  recentScansForPrompt,
} from "@/lib/offlineDb/queries";
import { requestSyncSoon } from "@/lib/offlineDb/syncEngine";

const GREETING_RE =
  /^(?:\s*(?:হ্যালো|হাই|hello|hi|নমস্কার|আসসালামু\s*আলাইকুম|সালাম|কেমন\s*আছ(?:েন)?|শুভ\s*(?:সকাল|দুপুর|বিকেল|সন্ধ্যা)|good\s*morning)[!?।.\s]*)+$/i;

const TIME_ASK_RE =
  /(?:ক(?:য়|ত)\s*টা|ক(?:য়|ত)টা|সময়|time|ঘড়|বাজে|কখন\s*হল)/i;

const WEATHER_ASK_RE =
  /বৃষ্টি|আবহাওয়া|তাপমাত্রা|টেম্প|টেম্পারেচার|গরম|ঠান্ডা|ডিগ্রি|humidity|rain|weather|temp/i;

const DISEASE_ASK_RE =
  /রোগ|দাগ|পাতা|হলুদ|পোকা|ছত্রাক|ব্লাইট|স্ক্যান|চিকিৎসা|লক্ষণ|ফসল|টমেটো|ধান|আলু|মরিচ/i;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSimpleGreeting(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 36) return false;
  return GREETING_RE.test(t);
}

/** Fast path — no LLM needed (small models ruin these). */
export function tryDeterministicReply(userTextBn: string): string | null {
  const t = userTextBn.trim();
  if (!t) return null;
  if (isSimpleGreeting(t)) return buildWelcomeBn();
  if (TIME_ASK_RE.test(t)) return timeReplyBn();
  if (WEATHER_ASK_RE.test(t)) {
    return (
      weatherReplyBn() ??
      "লাইভ আবহাওয়া এখন নেই। হোম স্ক্রিনে একবার অনলাইন থাকলে আবহাওয়া দেখা যাবে।"
    );
  }
  return null;
}

/**
 * Prompt for Q&A turns only — no greeting examples (models copy them forever).
 */
export function buildGroundedPrompt(
  userTextBn: string,
  extraContext: string[] = [],
): string {
  const name = currentUserFirstName();
  const wantWeather = WEATHER_ASK_RE.test(userTextBn);
  const session = buildSessionFacts({ includeWeather: wantWeather });
  const rag = retrieveContext(userTextBn);
  const facts = [...session, ...rag, ...extraContext].slice(0, 7);

  return [
    "তুমি আরণ্য, কৃষি সহকারী। সরাসরি উত্তর দাও।",
    "নিয়ম: ১–২ ছোট বাংলা বাক্য। প্রশ্ন আবার লিখবে না। অভিবাদন দিও না (শুভ সকাল/হ্যালো নয়) যদি প্রশ্ন অভিবাদন না হয়।",
    "নাম জানা থাকলে নাম জিজ্ঞাসা করবে না। নিজেকে ব্যবহারকারীর নাম বলো না।",
    "আগের কথোপকথন থাকলে সেই প্রসঙ্গে উত্তর দাও (যেমন «হ্যাঁ» মানে আগের প্রশ্নের জবাব)।",
    "টমেটো/রোগ জিজ্ঞাসা হলে স্ক্যান/ছবির পরামর্শ দিতে পারো।",
    name ? `নাম: ${name}` : "",
    facts.length ? `তথ্য:\n- ${facts.join("\n- ")}` : "",
    "",
    `প্রশ্ন: ${userTextBn.trim()}`,
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
    );

  if (!opts.allowGreeting) {
    // Models paste the canned welcome onto every answer.
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
  out = out.replace(/এখন\s*কতক্ষণ\s*পর[?؟।.!?]?\s*/gi, "");

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

/** Grounded reply for one user turn. */
export async function runLlmTurn(
  userTextBn: string,
  onTextChunk: (token: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<string> {
  const end = markStart("chat.llm");
  const cleaned = userTextBn.trim();

  const fast = tryDeterministicReply(cleaned);
  if (fast) {
    emitAll(fast, onTextChunk, shouldContinue);
    end("deterministic");
    return fast;
  }

  const [scans, recent] = await Promise.all([
    DISEASE_ASK_RE.test(cleaned) || /হ্যাঁ|হা|ঠিক|দেখেছি|আছে/i.test(cleaned)
      ? recentScansForPrompt().catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    recentChatForPrompt(4).catch(() => [] as string[]),
  ]);

  // For short follow-ups, force scan/KB context if last topic was disease.
  const extra = [
    ...scans,
    ...(recent.length
      ? [`আগের কথা:\n${recent.join("\n")}`]
      : []),
  ];

  // Affirmation after disease talk → steer to scan without LLM waffle.
  if (
    /^(হ্যাঁ|হা|জি|ঠিক|দেখেছি|আছে)[!?।.\s]*$/i.test(cleaned) &&
    recent.some((l) => /রোগ|টমেটো|পাতা|স্ক্যান/i.test(l))
  ) {
    const tip =
      "তাহলে নিচের ক্যামেরা আইকন দিয়ে আক্রান্ত পাতার স্পষ্ট ছবি তুলুন — আমি রোগ শনাক্ত করে চিকিৎসা বলব।";
    emitAll(tip, onTextChunk, shouldContinue);
    end("followup-scan");
    return tip;
  }

  if (!isLlmReady()) {
    const tip =
      "মডেল এখন প্রস্তুত নয়। মডেল ম্যানেজার থেকে জেমা ডাউনলোড করে আবার চেষ্টা করুন।";
    emitAll(tip, onTextChunk, shouldContinue);
    end("llm-missing");
    return tip;
  }

  const prompt = buildGroundedPrompt(cleaned, extra);
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

  await streamLlmReply(prompt, feed, { userText: cleaned });

  if (!prefixDone && prefixBuf) {
    const cleanedPrefix = sanitizeAssistantReply(prefixBuf);
    if (cleanedPrefix && shouldContinue()) {
      full += cleanedPrefix;
      onTextChunk(cleanedPrefix);
    }
  }

  let reply = sanitizeAssistantReply(full);
  if (!reply) {
    reply = "একটু অন্যভাবে বলুন — আমি সাহায্য করতে চাই।";
    if (shouldContinue()) onTextChunk(reply);
  }
  end("ok");
  return reply;
}

export async function persistTurn(role: "user" | "assistant", text: string) {
  try {
    await insertChatTurn(role, text);
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
  const canFast = !!tryDeterministicReply(cleaned);
  if (!isLlmReady() && !canFast) {
    handlers.onError?.(new Error("llm-not-ready"));
    handlers.onDone();
    return;
  }
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
        if (!isLlmReady() && !tryDeterministicReply(cleaned)) {
          handlers.onError?.(new Error("llm-not-ready"));
          handlers.onDone();
          return;
        }
        const reply = isLlmReady()
          ? await runLlmTurn(cleaned, handlers.onTextChunk)
          : tryDeterministicReply(cleaned) ?? "";
        if (reply) {
          if (!isLlmReady()) handlers.onTextChunk(reply);
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
