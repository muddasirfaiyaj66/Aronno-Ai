/**
 * Online chat on Google's free Gemini API, straight from the phone.
 *
 * Free Flash-Lite models only (never Pro): the first one that answers wins;
 * a model that is missing (404), out of free quota (429) or failing (5xx) is
 * skipped, and one that hit its quota is rested for a minute. Replies stream
 * over SSE (`streamGenerateContent?alt=sse`) through XMLHttpRequest progress
 * events, so text and voice start before the answer is finished.
 *
 * Gemma 4 31B is also on this API, but on the free tier it answered in ~40 s
 * or failed with 500 in testing, so it is not in the default list. Set
 * EXPO_PUBLIC_GEMINI_CHAT_MODEL to try a model first.
 */
import type { LlmHistoryTurn } from "@/lib/modelManager/llmEngine";
import { buildSystemPrompt, recentHistory } from "@/lib/offlineChat/cloudPrompt";

const FREE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
];

/** No first word by then → try the next model. */
const FIRST_TOKEN_MS = 12_000;
/** Hard stop for one answer, all models together. */
const TOTAL_MS = 45_000;
const QUOTA_REST_MS = 60_000;
const restUntil = new Map<string, number>();

function geminiKey(): string {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ?? "";
}

export function hasGeminiKey(): boolean {
  return geminiKey().length > 20;
}

/** Optional preferred model; Pro is never used (not free). */
function modelOrder(): string[] {
  const preferred = process.env.EXPO_PUBLIC_GEMINI_CHAT_MODEL?.trim();
  const list =
    preferred && !/pro/i.test(preferred) ? [preferred, ...FREE_MODELS] : FREE_MODELS;
  const now = Date.now();
  return [...new Set(list)].filter((m) => (restUntil.get(m) ?? 0) <= now);
}

function requestBody(model: string, userText: string, history: LlmHistoryTurn[], facts: string[]) {
  // Gemini wants user/model turns that alternate and start with the user.
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const t of [...recentHistory(history), { role: "user" as const, text: userText.slice(0, 800) }]) {
    const role = t.role === "assistant" ? "model" : "user";
    if (!contents.length && role === "model") continue;
    const last = contents[contents.length - 1];
    if (last?.role === role) last.parts[0].text += `\n${t.text}`;
    else contents.push({ role, parts: [{ text: t.text }] });
  }
  return {
    system_instruction: { parts: [{ text: buildSystemPrompt(facts) }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 900,
      // Gemma thinks in English first unless told not to; Flash-Lite ignores this.
      ...(/gemma/i.test(model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
    },
  };
}

type Attempt = { text: string; status: number };

/** One model, streamed. Resolves with what it wrote and the HTTP status. */
function streamOne(
  model: string,
  body: unknown,
  onToken: (token: string) => void,
  shouldContinue: () => boolean,
  deadline: number,
): Promise<Attempt> {
  return new Promise<Attempt>((resolve) => {
    const xhr = new XMLHttpRequest();
    let text = "";
    let seen = 0;
    let pending = "";
    let settled = false;
    let gotToken = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(watch);
      clearTimeout(firstTimer);
      clearTimeout(totalTimer);
      resolve({ text: text.trim(), status: xhr.status });
    };
    const abort = () => {
      try {
        xhr.abort();
      } catch {
        // already closed
      }
      finish();
    };

    const consume = (chunk: string) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5)) as {
            candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
          };
          for (const part of event.candidates?.[0]?.content?.parts ?? []) {
            if (part.thought || !part.text) continue;
            gotToken = true;
            text += part.text;
            if (shouldContinue()) onToken(part.text);
          }
        } catch {
          // partial or non-JSON line
        }
      }
    };
    const readNew = () => {
      if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) return;
      const all = xhr.responseText ?? "";
      if (all.length > seen) {
        const next = all.slice(seen);
        seen = all.length;
        consume(next);
      }
    };

    const watch = setInterval(() => {
      if (!shouldContinue()) abort();
    }, 200);
    const firstTimer = setTimeout(() => {
      if (!gotToken) abort();
    }, Math.min(FIRST_TOKEN_MS, Math.max(1_000, deadline - Date.now())));
    const totalTimer = setTimeout(abort, Math.max(1_000, deadline - Date.now()));

    xhr.open(
      "POST",
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    );
    xhr.setRequestHeader("x-goog-api-key", geminiKey());
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onprogress = readNew;
    xhr.onload = () => {
      readNew();
      consume("\n");
      finish();
    };
    xhr.onerror = finish;
    xhr.ontimeout = finish;
    xhr.onabort = finish;
    xhr.send(JSON.stringify(body));
  });
}

/**
 * Stream a reply from the first free model that answers. `onToken` gets each
 * new piece; resolves with the full text ("" if every model failed or the
 * farmer pressed stop). Never switches model once text has started.
 */
export async function streamCloudGemini(
  userText: string,
  history: LlmHistoryTurn[],
  facts: string[],
  onToken: (token: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<string> {
  if (!hasGeminiKey()) return "";
  const deadline = Date.now() + TOTAL_MS;
  for (const model of modelOrder()) {
    if (!shouldContinue() || deadline - Date.now() < 2_000) break;
    const { text, status } = await streamOne(
      model,
      requestBody(model, userText, history, facts),
      onToken,
      shouldContinue,
      deadline,
    );
    if (text) return text;
    if (status === 429) restUntil.set(model, Date.now() + QUOTA_REST_MS);
    // 401/403: the key itself is bad — other models won't help.
    if (status === 401 || status === 403) break;
  }
  return "";
}
