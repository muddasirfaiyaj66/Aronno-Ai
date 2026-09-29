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
  facts: string[] = [],
): Promise<string> {
  const key = process.env.EXPO_PUBLIC_OLLAMA_API_KEY?.trim();
  if (!key) return "";

  const grounding = Array.from(
    new Set(facts.map((f) => f.trim()).filter(Boolean)),
  ).slice(0, 28);

  const messages = [
    {
      role: "system",
      content: [
        "তুমি আরণ্য — বাংলাদেশের কৃষকদের সহকারী। কথা বলো একজন উষ্ণ, বয়স্ক নারী প্রতিবেশীর মতো: ছোট বাক্য, স্বাভাবিক ঢাকাই বাংলা, ঘোষণার ভঙ্গি নয়।",
        "বাংলা হরফে ২–৪টি বাক্যে উত্তর দাও। প্রশ্ন আবার লিখবে না।",
        "অভিবাদনে «নমস্কার» বা nomoskar কখনো বলবে না। হ্যালো বলতে পারো, অথবা সরাসরি নাম ধরে কথা শুরু করো।",
        "কৃষক চিন্তিত, ক্লান্ত, রাগান্বিত বা আশাবাদী হলে প্রথমে সেই অনুভূতি এক বাক্যে স্বীকার করো, তারপর পরামর্শ দাও।",
        "বাংলিশ বোঝো: Hi/Hai = হ্যালো, Ki obosta = কেমন আছ, Kire/কিরে = ডাক, Oi = হেই। এগুলো নাম বা খাবার নয়।",
        grounding.length
          ? "নিচের তথ্য ফোনের ঘড়ি, আবহাওয়া, প্রোফাইল, স্ক্যান, অর্ডার, ওয়ালেট, কার্ট, দোকান, বিজ্ঞপ্তি, ফসল পরিকল্পনা, বাজার ও জ্ঞানভাণ্ডার থেকে নেওয়া। সময়, তারিখ, আবহাওয়া, জেলা, স্ক্যান, দাম, অর্ডার ও টাকার উত্তরে এই সংখ্যা ও নাম হুবহু বলো। তথ্যে না থাকলে ওষুধের মাত্রা, দাম বা অর্ডার বানাবে না। «উদ্দেশ্য» ও «নির্দেশ» লাইন কৃষককে দেখাবে না।"
          : "কৃষি প্রশ্নে ব্যবহারিক পরামর্শ দাও। ওষুধের মাত্রা নিশ্চিত না হলে বলবে না।",
        grounding.length ? `জ্ঞানভাণ্ডার:\n- ${grounding.join("\n- ")}` : "",
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
