import * as Speech from "expo-speech";
import { VoiceQuality } from "expo-speech";
import { enablePlaybackAudio } from "@/lib/speechRecording";

const LANGS = ["bn-BD", "bn-IN", "bn"] as const;

type VoicePick = { language: string; voice?: string };

let cachedPick: VoicePick | null = null;
let pickPromise: Promise<VoicePick> | null = null;

/** Prefer clearer / neural Bangla voices when the OS exposes them. */
function scoreVoice(v: Speech.Voice): number {
  const id = `${v.identifier} ${v.name} ${v.language}`.toLowerCase();
  let score = 0;
  if (id.includes("bn-bd") || id.includes("bengali bangladesh")) score += 40;
  else if (id.includes("bn-in") || id.includes("bengali")) score += 30;
  else if (id.startsWith("bn") || id.includes(" bn")) score += 20;
  if (id.includes("neural") || id.includes("wavenet") || id.includes("natural"))
    score += 25;
  if (id.includes("enhanced") || id.includes("premium") || id.includes("hq")) score += 15;
  if (id.includes("female") || id.includes("woman") || id.includes("samantha")) score += 8;
  if (id.includes("local") || id.includes("offline")) score += 5;
  if (id.includes("network") || id.includes("online")) score -= 3;
  if (v.quality === VoiceQuality.Enhanced) score += 20;
  return score;
}

async function resolveBanglaVoice(): Promise<VoicePick> {
  if (cachedPick) return cachedPick;
  if (pickPromise) return pickPromise;

  pickPromise = (async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const bangla = voices
        .filter((v) => /^bn/i.test(v.language) || /bengali/i.test(v.name))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));
      if (bangla[0]) {
        const pick = {
          language: bangla[0].language || "bn-BD",
          voice: bangla[0].identifier,
        };
        cachedPick = pick;
        return pick;
      }
    } catch {
      // fall through
    }
    const pick = { language: "bn-BD" as string, voice: undefined };
    cachedPick = pick;
    return pick;
  })();

  try {
    return await pickPromise;
  } finally {
    pickPromise = null;
  }
}

/**
 * Make Bangla TTS fluent, natural and conversational (like Gemini voice):
 * expands symbols, cleans markdown and prompt tags, softens punctuation.
 */
export function prepareSpeechText(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  // Strip URLs and web references
  s = s.replace(/https?:\/\/\S+/gi, "");

  // Strip markdown formatting symbols
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/^#+\s+/gm, "");

  // Strip prompt tags or brackets
  s = s.replace(/\[[^\]]*\]/g, "");
  s = s.replace(/<[^>]+>/g, "");

  // Expand unit and technical symbols to natural spoken Bengali
  s = s.replace(/(\d+)\s*°\s*[Cc]?/g, "$1 ডিগ্রি সেলসিয়াস ");
  s = s.replace(/(\d+)\s*°\s*[Ff]?/g, "$1 ডিগ্রি ফারেনহাইট ");
  s = s.replace(/[°˚]/g, " ডিগ্রি ");
  s = s.replace(/%/g, " শতাংশ ");
  s = s.replace(/(\d+)\s*কিমি\/?ঘ(?:ণ্টা)?/g, "$1 কিলোমিটার প্রতি ঘণ্টা ");
  s = s.replace(/(\d+)\s*কেজি\/?বিঘা/g, "$1 কেজি প্রতি বিঘা ");
  s = s.replace(/\bকেজি\b/g, " কেজি ");
  s = s.replace(/\bমিমি\b/g, " মিলিমিটার ");
  s = s.replace(/৳\s*(\d+)/g, "$1 টাকা");
  s = s.replace(/৳/g, " টাকা ");

  // Soften list bullets and numbering for natural speech
  s = s.replace(/^\s*\d+[.)]\s*/gm, "");
  s = s.replace(/^\s*[•·▪︎*+\-]\s*/gm, "");

  // Replace slash and hyphens with natural pauses
  s = s.replace(/[/|\\]/g, " বা ");
  s = s.replace(/[–—_~]/g, " ");
  s = s.replace(/["'«»]/g, "");

  // Normalize punctuation spacing
  s = s.replace(/\s*([।!?.,;:])\s*/g, "$1 ");
  s = s.replace(/([।!?]){2,}/g, "$1");
  s = s.replace(/\s+/g, " ").trim();

  return s.slice(0, 3900);
}

/** Split into speakable chunks so the engine doesn't rush or drop mid-clause. */
export function splitSpeechChunks(text: string): string[] {
  const prepared = prepareSpeechText(text);
  if (!prepared) return [];

  const parts = prepared
    .split(/(?<=[।!?\.])\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const part of parts) {
    const next = buf ? `${buf} ${part}` : part;
    if (next.length > 140 && buf) {
      chunks.push(buf);
      buf = part;
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);

  // Very long single sentence — soft-split on commas / connectors.
  return chunks.flatMap((c) => {
    if (c.length <= 180) return [c];
    const soft = c.split(/(?<=[,;]| এবং | আর | কিন্তু )\s+/);
    const out: string[] = [];
    let b = "";
    for (const s of soft) {
      const n = b ? `${b} ${s}` : s;
      if (n.length > 160 && b) {
        out.push(b);
        b = s;
      } else b = n;
    }
    if (b) out.push(b);
    return out;
  });
}

function speakOnce(
  text: string,
  language: string,
  voice: string | undefined,
  signal: { stopped: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.stopped) {
      resolve();
      return;
    }
    Speech.speak(text, {
      language,
      voice,
      // Slightly slower + steady pitch = clearer Bangla on device TTS.
      rate: 0.86,
      pitch: 1.02,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (err) => reject(err instanceof Error ? err : new Error("tts")),
    });
  });
}

function pause(ms: number, signal: { stopped: boolean }) {
  return new Promise<void>((resolve) => {
    if (signal.stopped) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });
}

let activeSignal: { stopped: boolean } | null = null;

export async function speakBangla(
  text: string,
  handlers?: { onDone?: () => void; onStopped?: () => void; onError?: () => void },
) {
  const chunks = splitSpeechChunks(text);
  if (!chunks.length) {
    handlers?.onDone?.();
    return;
  }

  await Speech.stop();
  const signal = { stopped: false };
  activeSignal = signal;

  try {
    await enablePlaybackAudio();
  } catch {
    // still try device TTS
  }

  const pick = await resolveBanglaVoice();

  try {
    for (let i = 0; i < chunks.length; i++) {
      if (signal.stopped) {
        handlers?.onStopped?.();
        return;
      }
      try {
        await speakOnce(chunks[i], pick.language, pick.voice, signal);
      } catch {
        // Retry chunk without a pinned voice id (some identifiers are flaky).
        await speakOnce(chunks[i], pick.language, undefined, signal);
      }
      // Breath between sentences — makes speech feel fluent, not robotic dump.
      if (i < chunks.length - 1) await pause(140, signal);
    }
    if (signal.stopped) handlers?.onStopped?.();
    else handlers?.onDone?.();
  } catch (err) {
    handlers?.onError?.();
    throw err instanceof Error ? err : new Error("tts");
  } finally {
    if (activeSignal === signal) activeSignal = null;
  }
}

export async function stopBanglaSpeech() {
  if (activeSignal) activeSignal.stopped = true;
  await Speech.stop();
}

/** Force re-resolve voices after OS language packs change. */
export function resetBanglaVoiceCache() {
  cachedPick = null;
}
