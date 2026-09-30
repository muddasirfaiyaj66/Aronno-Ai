/**
 * Online chat through Ollama cloud (gemma4:31b-cloud). Used only when no
 * Gemini key is set — see cloudChat.ts.
 * ollama.com expects the name without the "-cloud" suffix.
 * Offline turns stay on llama.rn. The Nest API keeps using Gemini.
 *
 * Streams: tokens arrive as NDJSON lines and are handed out as they come, so
 * the chat bubble fills and the voice starts before the answer is finished.
 * Uses XMLHttpRequest progress events — React Native's fetch cannot stream,
 * and this needs no new native module.
 */
import type { LlmHistoryTurn } from "@/lib/modelManager/llmEngine";
import { buildSystemPrompt, recentHistory } from "@/lib/offlineChat/cloudPrompt";

const HOST = (
  process.env.EXPO_PUBLIC_OLLAMA_HOST ?? "https://ollama.com"
).replace(/\/$/, "");
const REQUESTED =
  process.env.EXPO_PUBLIC_OLLAMA_CHAT_MODEL?.trim() || "gemma4:31b-cloud";

/** No first word by then → give up and let on-device Gemma answer. */
const FIRST_TOKEN_MS = 12_000;
/** Hard stop for the whole answer. */
const TOTAL_MS = 45_000;

function modelName(): string {
  if (HOST.includes("ollama.com") && REQUESTED.endsWith("-cloud")) {
    return REQUESTED.slice(0, -"-cloud".length);
  }
  return REQUESTED;
}

export function hasOllamaKey(): boolean {
  return (process.env.EXPO_PUBLIC_OLLAMA_API_KEY?.trim().length ?? 0) > 8;
}

function buildMessages(
  userText: string,
  history: LlmHistoryTurn[],
  facts: string[],
) {
  return [
    { role: "system", content: buildSystemPrompt(facts) },
    ...recentHistory(history).map((t) => ({
      role: t.role === "assistant" ? "assistant" : "user",
      content: t.text,
    })),
    { role: "user", content: userText.slice(0, 800) },
  ];
}

/**
 * Stream a reply. `onToken` receives each new piece of text. Resolves with
 * the full text ("" when the key is missing, the network fails, the first
 * word is too slow, or `shouldContinue()` turns false).
 */
export function streamCloudGemma(
  userText: string,
  history: LlmHistoryTurn[],
  facts: string[],
  onToken: (token: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<string> {
  const key = process.env.EXPO_PUBLIC_OLLAMA_API_KEY?.trim();
  if (!key) return Promise.resolve("");

  return new Promise<string>((resolve) => {
    const xhr = new XMLHttpRequest();
    let full = "";
    let seen = 0; // chars of responseText already parsed
    let pending = ""; // partial NDJSON line
    let settled = false;
    let gotToken = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(watch);
      clearTimeout(firstTimer);
      clearTimeout(totalTimer);
      resolve(full.trim());
    };
    const abort = () => {
      try {
        xhr.abort();
      } catch {
        // already closed
      }
      finish();
    };

    const consume = (text: string) => {
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
            error?: string;
          };
          if (chunk.error) {
            abort();
            return;
          }
          const piece = chunk.message?.content ?? "";
          if (piece) {
            gotToken = true;
            full += piece;
            if (shouldContinue()) onToken(piece);
          }
          if (chunk.done) {
            finish();
            return;
          }
        } catch {
          // ignore a malformed line
        }
      }
    };

    const readNew = () => {
      const text = xhr.responseText ?? "";
      if (text.length > seen) {
        const next = text.slice(seen);
        seen = text.length;
        consume(next);
      }
    };

    // Stop button / new chat → cut the network call immediately.
    const watch = setInterval(() => {
      if (!shouldContinue()) abort();
    }, 200);
    const firstTimer = setTimeout(() => {
      if (!gotToken) abort();
    }, FIRST_TOKEN_MS);
    const totalTimer = setTimeout(abort, TOTAL_MS);

    xhr.open("POST", `${HOST}/api/chat`);
    xhr.setRequestHeader("Authorization", `Bearer ${key}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onprogress = readNew;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        readNew();
        consume("\n");
      } else {
        full = "";
      }
      finish();
    };
    xhr.onerror = finish;
    xhr.ontimeout = finish;
    xhr.onabort = finish;
    xhr.send(
      JSON.stringify({
        model: modelName(),
        messages: buildMessages(userText, history, facts),
        stream: true,
        options: { temperature: 0.4, num_predict: 450 },
      }),
    );
  });
}

/** Non-streaming convenience wrapper (kept for any caller that wants one string). */
export async function replyWithCloudGemma(
  userText: string,
  history: LlmHistoryTurn[] = [],
  facts: string[] = [],
): Promise<string> {
  return streamCloudGemma(userText, history, facts, () => undefined);
}
