/**
 * Female Bangla voice from the phone, using a separate free Gemini key.
 * Model is Flash-Lite TTS only — free on an AI Studio key with billing off.
 * The server diagnosis key is never used here.
 */
const TTS_MODEL = "gemini-3.8-flash-lite-tts";
const VOICE = "Kore";
const STYLE =
  "Warm Bangladeshi woman in her thirties. Natural Dhaka Bangla, calm caring neighbor, moderate pace, soft empathy, conversational. Not a news reader, not theatrical, not a child.";
const MAX_CHARS = 480;

type AudioPart = { type?: string; data?: string };
type InteractionBody = {
  output_audio?: { data?: string };
  steps?: { content?: AudioPart[] }[];
};

function ttsKey(): string {
  // A separate voice key keeps chat and voice on separate free limits.
  return (
    process.env.EXPO_PUBLIC_GEMINI_TTS_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ||
    ""
  );
}

function audioBase64(body: InteractionBody): string | null {
  const chunks = [
    body.output_audio?.data,
    ...(body.steps ?? []).flatMap((step) =>
      (step.content ?? [])
        .filter((part) => !part.type || part.type === "audio")
        .map((part) => part.data),
    ),
  ].filter((value): value is string => !!value && value.length > 80);
  return chunks.at(-1) ?? null;
}

/** WAV base64, or null when the free key is missing or Gemini refuses the clip. */
export async function synthesizeGeminiFemale(
  text: string,
): Promise<string | null> {
  const key = ttsKey();
  if (key.length < 8) return null;
  const transcript = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!transcript) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: TTS_MODEL,
          input: [
            {
              type: "user_input",
              content: [
                {
                  type: "text",
                  text: transcript,
                  annotations: [{ type: "speech_metadata", style: STYLE }],
                },
              ],
            },
          ],
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [{ voice: VOICE }],
          },
        }),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as InteractionBody;
    return audioBase64(body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
