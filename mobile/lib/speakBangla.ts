import * as Speech from "expo-speech";
import { VoiceQuality } from "expo-speech";
import { enablePlaybackAudio } from "@/lib/speechRecording";

const LANGS = ["bn-BD", "bn-IN", "bn"] as const;

type VoicePick = { language: string; voice?: string; pitch: number };

let cachedPick: VoicePick | null = null;
let pickPromise: Promise<VoicePick> | null = null;

function voiceLabel(v: Speech.Voice): string {
  return `${v.identifier} ${v.name} ${v.language}`.toLowerCase();
}

function isFemaleVoice(v: Speech.Voice): boolean {
  const id = voiceLabel(v);
  return (
    id.includes("female") ||
    id.includes("woman") ||
    id.includes("nabanita") ||
    id.includes("tanishaa")
  );
}

function isMaleVoice(v: Speech.Voice): boolean {
  const id = voiceLabel(v);
  return (
    id.includes("male") ||
    id.includes("pradeep") ||
    id.includes("bashkar")
  );
}

/** Prefer a female Bangla voice. A lone male system voice is pitched up. */
function scoreVoice(v: Speech.Voice): number {
  const id = voiceLabel(v);
  let score = 0;
  if (id.includes("bn-bd") || id.includes("bengali bangladesh")) score += 40;
  else if (id.includes("bn-in") || id.includes("bengali")) score += 30;
  else if (id.startsWith("bn") || id.includes(" bn")) score += 20;
  if (id.includes("neural") || id.includes("wavenet") || id.includes("natural"))
    score += 25;
  if (id.includes("enhanced") || id.includes("premium") || id.includes("hq")) score += 15;
  if (isFemaleVoice(v)) score += 80;
  if (isMaleVoice(v)) score -= 80;
  if (id.includes("local") || id.includes("offline")) score += 5;
  if (v.quality === VoiceQuality.Enhanced) score += 20;
  return score;
}

function pitchFor(v: Speech.Voice | undefined): number {
  if (!v) return 1.45;
  if (isFemaleVoice(v)) return 1.02;
  if (isMaleVoice(v)) return 1.55;
  return 1.35;
}

async function resolveBanglaVoice(): Promise<VoicePick> {
  if (cachedPick) return cachedPick;
  if (pickPromise) return pickPromise;

  pickPromise = (async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const bangla = voices.filter(
        (v) => /^bn/i.test(v.language) || /bengali/i.test(v.name),
      );
      const female = bangla.filter((v) => !isMaleVoice(v));
      const pool = (female.length ? female : bangla).sort(
        (a, b) => scoreVoice(b) - scoreVoice(a),
      );
      if (pool[0]) {
        const pick = {
          language: pool[0].language || "bn-BD",
          voice: pool[0].identifier,
          pitch: pitchFor(pool[0]),
        };
        cachedPick = pick;
        return pick;
      }
    } catch {
      // fall through
    }
    const pick = { language: "bn-BD" as string, voice: undefined, pitch: 1.45 };
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

  return s.slice(0, 8000);
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
  pitch: number,
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
      rate: 0.92,
      pitch,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (err) => reject(err instanceof Error ? err : new Error("tts")),
    });
  });
}

let activeSignal: { stopped: boolean } | null = null;

export async function speakBangla(
  text: string,
  handlers?: { onDone?: () => void; onStopped?: () => void; onError?: () => void },
) {
  const prepared = prepareSpeechText(text);
  if (!prepared) {
    handlers?.onDone?.();
    return;
  }
  // One continuous utterance. Splitting with pauses is what made replies sound laggy.
  const chunks =
    prepared.length > 700 ? splitSpeechChunks(prepared) : [prepared];

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
        await speakOnce(chunks[i], pick.language, pick.voice, pick.pitch, signal);
      } catch {
        await speakOnce(chunks[i], pick.language, pick.voice, pick.pitch, signal);
      }
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
