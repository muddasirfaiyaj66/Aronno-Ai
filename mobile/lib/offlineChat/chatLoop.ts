/**
 * Offline realtime chat: STT → grounded Gemma LLM → sentence-chunked TTS.
 * Persists turns to SQLite and grounds prompts with recent local history.
 */
import { startListening } from "@/lib/offlineVoice/sttEngine";
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import { retrieveContext } from "@/lib/offlineNlu/retrieve";
import { isLlmReady, streamLlmReply } from "@/lib/modelManager/llmEngine";
import { logMetric, markStart } from "@/lib/offline/metrics";
import {
  insertChatTurn,
  recentChatAndScansForPrompt,
} from "@/lib/offlineDb/queries";
import { requestSyncSoon } from "@/lib/offlineDb/syncEngine";

export const SYSTEM_PROMPT_BN =
  "তুমি আরণ্য, বাংলাদেশের কৃষকদের জন্য একজন সহায়ক কৃষি সহকারী। " +
  "সবসময় সহজ, সংক্ষিপ্ত বাংলায় উত্তর দাও। নিচের তথ্য সঠিক হিসেবে ব্যবহার করো, " +
  "এর বাইরে অনুমান করে ওষুধ বা মাত্রা বলো না, অনিশ্চিত হলে কৃষি সম্প্রসারণ অফিসে যোগাযোগের পরামর্শ দাও।";

export function buildGroundedPrompt(
  userTextBn: string,
  extraContext: string[] = [],
): string {
  const context = [...retrieveContext(userTextBn), ...extraContext].slice(0, 6);
  return [
    SYSTEM_PROMPT_BN,
    context.length ? `প্রাসঙ্গিক তথ্য:\n${context.join("\n")}` : "",
    `কৃষকের প্রশ্ন: ${userTextBn}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type ChatTurnHandlers = {
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onTextChunk: (token: string) => void;
  onDone: () => void;
  onError?: (err: unknown) => void;
};

async function runLlmTurn(
  userTextBn: string,
  onTextChunk: (token: string) => void,
): Promise<string> {
  const end = markStart("chat.llm");
  const historyCtx = await recentChatAndScansForPrompt(6).catch(() => [] as string[]);
  const prompt = buildGroundedPrompt(userTextBn, historyCtx);
  let sentenceBuffer = "";
  let full = "";
  await streamLlmReply(prompt, (token) => {
    sentenceBuffer += token;
    full += token;
    onTextChunk(token);
    if (/[।.!?]/.test(token)) {
      void streamOffline(sentenceBuffer);
      sentenceBuffer = "";
    }
  });
  if (sentenceBuffer.trim()) {
    void streamOffline(sentenceBuffer);
  }
  end("ok");
  return full.trim();
}

async function persistTurn(role: "user" | "assistant", text: string) {
  try {
    await insertChatTurn(role, text);
    requestSyncSoon();
  } catch {
    // DB may be unavailable on first boot
  }
}

/** Typed (or already-final) user message → grounded LLM stream. */
export async function replyToText(
  userTextBn: string,
  handlers: Pick<ChatTurnHandlers, "onTextChunk" | "onDone" | "onError">,
): Promise<void> {
  if (!isLlmReady()) {
    handlers.onError?.(new Error("llm-not-ready"));
    handlers.onDone();
    return;
  }
  const cleaned = userTextBn.trim();
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

/**
 * Starts mic listening; on final STT runs the LLM and streams TTS per sentence.
 * Returns a stop function.
 */
export function startChatTurn(handlers: ChatTurnHandlers): () => void {
  return startListening(
    (partial) => handlers.onPartialTranscript?.(partial),
    async (finalTextBn) => {
      handlers.onFinalTranscript?.(finalTextBn);
      if (!isLlmReady()) {
        handlers.onError?.(new Error("llm-not-ready"));
        handlers.onDone();
        return;
      }
      try {
        logMetric("chat.voice.final");
        await persistTurn("user", finalTextBn.trim());
        const reply = await runLlmTurn(finalTextBn, handlers.onTextChunk);
        if (reply) await persistTurn("assistant", reply);
      } catch (err) {
        handlers.onError?.(err);
      } finally {
        handlers.onDone();
      }
    },
  );
}
