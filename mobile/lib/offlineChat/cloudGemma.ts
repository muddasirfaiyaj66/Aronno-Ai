/**
 * Online chat from the phone. Ollama cloud model gemma4:31b-cloud.
 * ollama.com expects the name without the "-cloud" suffix.
 * Offline turns stay on llama.rn. The Nest API keeps using Gemini.
 *
 * Streams: tokens arrive as NDJSON lines and are handed out as they come, so
 * the chat bubble fills and the voice starts before the answer is finished.
 * Uses XMLHttpRequest progress events — React Native's fetch cannot stream,
 * and this needs no new native module.
 */
import type { LlmHistoryTurn } from "@/lib/modelManager/llmEngine";

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

export function hasCloudChatKey(): boolean {
  return (process.env.EXPO_PUBLIC_OLLAMA_API_KEY?.trim().length ?? 0) > 8;
}

function buildMessages(
  userText: string,
  history: LlmHistoryTurn[],
  facts: string[],
) {
  const grounding = Array.from(
    new Set(facts.map((f) => f.trim()).filter(Boolean)),
  ).slice(0, 24);

  return [
    {
      role: "system",
      content: [
        "তুমি আরণ্য — বাংলাদেশের কৃষকদের কৃষি সহকারী। উষ্ণ ও সম্মানজনক ভঙ্গিতে কথা বলো: কৃষককে «আপনি» বলো, সহজ প্রমিত বাংলা ব্যবহার করো।",
        "বাংলা হরফে উত্তর দাও। সাধারণ প্রশ্নে ২–৪টি ছোট বাক্য; চাষ, রোগ বা সারের প্রশ্নে নির্দিষ্ট পদক্ষেপসহ সর্বোচ্চ ৬টি বাক্য। প্রথম বাক্যেই মূল উত্তর দাও। প্রতিটি বাক্য দাঁড়ি (।) দিয়ে শেষ করো।",
        "প্রশ্ন আবার লিখবে না। মার্কডাউন, তারকাচিহ্ন, শিরোনাম বা বুলেট ব্যবহার করবে না — উত্তরটি জোরে পড়ে শোনানো হবে।",
        "অভিবাদনে «নমস্কার» বা nomoskar কখনো বলবে না। হ্যালো বলতে পারো, অথবা সরাসরি কথা শুরু করো।",
        "নিজের শরীর, ক্লান্তি বা ব্যক্তিগত গল্প বানাবে না। কৃষক চিন্তিত হলে এক বাক্যে সহানুভূতি জানিয়ে তারপর পরামর্শ দাও।",
        "বাংলিশ বোঝো: Hi/Hai = হ্যালো, Ki obosta = কেমন আছ, Kire/কিরে = ডাক, Oi = হেই। এগুলো নাম বা খাবার নয়।",
        "রোগ বা পোকার প্রশ্নে নিশ্চিত না হলে সম্ভাব্য কারণ বলো এবং অ্যাপে পাতার ছবি স্ক্যান করতে বলো।",
        grounding.length
          ? "নিচের «প্রসঙ্গ» ফোনের ঘড়ি, আবহাওয়া, প্রোফাইল, স্ক্যান, অর্ডার, ওয়ালেট, বাজার ও জ্ঞানভাণ্ডার থেকে নেওয়া — এটাই সত্য তথ্য। সময়, আবহাওয়া, দাম, অর্ডার বা টাকার প্রশ্নে সেই সংখ্যা হুবহু বলো। অন্য প্রশ্নে তালিকাটি আউড়ে বলবে না। প্রসঙ্গে না থাকলে ওষুধের মাত্রা, দাম বা অর্ডার বানাবে না। «উদ্দেশ্য» ও «নির্দেশ» লাইন কৃষককে দেখাবে না।"
          : "ওষুধের মাত্রা নিশ্চিত না হলে বলবে না।",
        grounding.length ? `প্রসঙ্গ:\n- ${grounding.join("\n- ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...history.slice(-6).map((t) => ({
      role: t.role === "assistant" ? "assistant" : "user",
      content: t.text.slice(0, 500),
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
