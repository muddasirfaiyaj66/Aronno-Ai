/** Catalog of downloadable offline models (LLM / STT / TTS). */

export type ModelKind = "llm" | "stt" | "tts";

export type ModelCatalogEntry = {
  /** Stable id — used as storage folder name */
  id: string;
  kind: ModelKind;
  nameBn: string;
  nameEn: string;
  /** Approximate download size shown before download */
  sizeMb: number;
  /** Rough RAM guidance shown to the user */
  minRamMb: number;
  /** Hugging Face "owner/repo" (or GitHub release owner for archives) */
  repo: string;
  /** Exact filename under the repo / archive */
  file: string;
  recommended?: boolean;
  /** Optional override when the download URL is not the HF resolve pattern */
  downloadUrl?: string;
};

/**
 * Local fallback catalog. Prefer fetching a remote JSON later (§9.2)
 * so new Gemma sizes can ship without an app-store update.
 */
export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "gemma3-270m-q8",
    kind: "llm",
    nameBn: "জেমা ৩ (ছোট, দ্রুততম)",
    nameEn: "Gemma 3 270M",
    sizeMb: 300,
    minRamMb: 2000,
    repo: "ggml-org/gemma-3-270m-GGUF",
    file: "gemma-3-270m-Q8_0.gguf",
    recommended: true,
  },
  {
    id: "gemma3-1b-q4",
    kind: "llm",
    nameBn: "জেমা ৩ (মাঝারি, ভালো মান)",
    nameEn: "Gemma 3 1B",
    sizeMb: 700,
    minRamMb: 3000,
    repo: "google/gemma-3-1b-it-qat-q4_0-gguf",
    file: "gemma-3-1b-it-q4_0.gguf",
  },
  {
    id: "stt-bn-zipformer",
    kind: "stt",
    nameBn: "বাংলা কণ্ঠ শনাক্তকরণ",
    nameEn: "Bangla Speech Recognition",
    sizeMb: 90,
    minRamMb: 1000,
    repo: "k2-fsa/sherpa-onnx",
    file: "sherpa-onnx-streaming-zipformer-bn-vosk-2026-02-09.tar.bz2",
    downloadUrl:
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bn-vosk-2026-02-09.tar.bz2",
    recommended: true,
  },
  {
    id: "tts-bn-vits",
    kind: "tts",
    nameBn: "বাংলা কণ্ঠস্বর (উচ্চারণ)",
    nameEn: "Bangla Voice (Speech)",
    sizeMb: 110,
    minRamMb: 1000,
    repo: "csukuangfj/sherpa-onnx-tts",
    file: "vits-bn-multi.tar.bz2",
    // Pin a concrete HF/GitHub URL when the VITS archive is chosen
    recommended: true,
  },
];

export function catalogById(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((e) => e.id === id);
}

export function catalogByKind(kind: ModelKind): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((e) => e.kind === kind);
}

export function defaultDownloadUrl(entry: ModelCatalogEntry): string {
  if (entry.downloadUrl) return entry.downloadUrl;
  return `https://huggingface.co/${entry.repo}/resolve/main/${entry.file}`;
}
