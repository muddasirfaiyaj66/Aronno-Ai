/**
 * Online chat from the phone. Ollama cloud model gemma4:31b-cloud.
 * ollama.com expects the name without the "-cloud" suffix.
 * Offline turns stay on llama.rn. The Nest API keeps using Gemini.
 */
import type { LlmHistoryTurn } from "@/lib/modelManager/llmEngine";

const HOST = (
  process.env.EXPO_PUBLIC_OLLAMA_HOST ?? "https://ollama.com"
).replace(/\/$/, "");
const REQUESTED =
  process.env.EXPO_PUBLIC_OLLAMA_CHAT_MODEL?.trim() || "gemma4:31b-cloud";

function modelName(): string {
  if (HOST.includes("ollama.com") && REQUESTED.endsWith("-cloud")) {
    return REQUESTED.slice(0, -"-cloud".length);
  }
  return REQUESTED;
}

export async function replyWithCloudGemma(
  userText: string,
  history: LlmHistoryTurn[] = [],
): Promise<string> {
  const key = process.env.EXPO_PUBLIC_OLLAMA_API_KEY?.trim();
  if (!key) return "";

  const messages = [
    {
      role: "system",
      content: [
        "তুমি আরণ্য — বাংলাদেশের কৃষকদের সহকারী।",
        "বাংলা হরফে ১–৩টি সহজ বাক্যে উত্তর দাও। প্রশ্ন আবার লিখবে না।",
        "বাংলিশ বোঝো: Hi/Hai = হ্যালো, Ki obosta = কেমন আছ, Kire/কিরে = ডাক, Oi = হেই। এগুলো নাম বা খাবার নয়।",
        "কৃষি প্রশ্নে ব্যবহারিক পরামর্শ দাও। ওষুধের মাত্রা নিশ্চিত না হলে বলবে না।",
      ].join(" "),
    },
    ...history.slice(-6).map((t) => ({
      role: t.role === "assistant" ? "assistant" : "user",
      content: t.text.slice(0, 500),
    })),
    { role: "user", content: userText.slice(0, 800) },
  ];

  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName(),
      messages,
      stream: false,
    }),
  });
  if (!res.ok) return "";
  const body = (await res.json()) as { message?: { content?: string } };
  return body.message?.content?.trim() ?? "";
}
