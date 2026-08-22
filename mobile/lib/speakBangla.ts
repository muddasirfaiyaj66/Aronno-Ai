import * as Speech from "expo-speech";
import { enablePlaybackAudio } from "@/lib/speechRecording";

const LANGS = ["bn-BD", "bn-IN", "bn"] as const;

async function banglaVoice(preferredLang: string): Promise<string | undefined> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const lang = preferredLang.toLowerCase();
    const match =
      voices.find((v) => v.language.toLowerCase().startsWith(lang)) ??
      voices.find((v) => v.language.toLowerCase().startsWith("bn"));
    return match?.identifier;
  } catch {
    return undefined;
  }
}

function speakOnce(
  text: string,
  language: string,
  voice?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language,
      voice,
      rate: 0.92,
      pitch: 1,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (err) => reject(err instanceof Error ? err : new Error("tts")),
    });
  });
}

export async function speakBangla(
  text: string,
  handlers?: { onDone?: () => void; onStopped?: () => void; onError?: () => void },
) {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 3900);
  if (!cleaned) {
    handlers?.onDone?.();
    return;
  }

  await Speech.stop();
  try {
    await enablePlaybackAudio();
  } catch {
    // still try device TTS
  }

  let lastError: unknown;
  for (const language of LANGS) {
    try {
      const voice = await banglaVoice(language);
      await speakOnce(cleaned, language, voice);
      handlers?.onDone?.();
      return;
    } catch (err) {
      lastError = err;
    }
  }

  handlers?.onError?.();
  throw lastError instanceof Error ? lastError : new Error("tts");
}

export async function stopBanglaSpeech() {
  await Speech.stop();
}
