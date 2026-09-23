/** Catalog of downloadable offline models (LLM / STT / TTS). */

export type ModelKind = "llm" | "stt" | "tts" | "vision";

export type ModelCatalogEntry = {
  id: string;
  kind: ModelKind;
  nameBn: string;
  nameEn: string;
  sizeMb: number;
  minRamMb: number;
  /** Hugging Face "owner/repo" (llm single-file) */
  repo: string;
  /** Primary filename (llm) or marker file used by isInstalled */
  file: string;
  recommended?: boolean;
  /** Single-archive / single-file override URL */
  downloadUrl?: string;
  /**
   * Multi-file download (preferred for STT/TTS — no tar.bz2 extract on device).
   * Each file is saved under models/<id>/<relativePath>.
   */
  files?: { relativePath: string; url: string }[];
};

const HF = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${file}`;

const BN_STT = "csukuangfj2/sherpa-onnx-streaming-zipformer-bn-vosk-2026-02-09";
const BN_TTS = "csukuangfj/vits-coqui-bn-custom_female";

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "gemma3-270m-q8",
    kind: "llm",
    nameBn: "জেমা ৩ (ছোট, দ্রুততম)",
    nameEn: "Gemma 3 270M Instruct",
    sizeMb: 300,
    minRamMb: 2000,
    // Must be -it (instruct). Base gemma-3-270m cannot chat.
    repo: "ggml-org/gemma-3-270m-it-GGUF",
    file: "gemma-3-270m-it-Q8_0.gguf",
  },
  {
    // The google/ repo is gated (HTTP 401 without a token) — use the public mirror.
    id: "gemma3-1b-it-q4",
    kind: "llm",
    nameBn: "জেমা ৩ (মাঝারি, বাংলায় ভালো)",
    nameEn: "Gemma 3 1B Instruct",
    sizeMb: 690,
    minRamMb: 3000,
    repo: "unsloth/gemma-3-1b-it-GGUF",
    file: "gemma-3-1b-it-Q4_0.gguf",
    recommended: true,
  },
  {
    id: "gemma3-4b-it-q4",
    kind: "llm",
    nameBn: "জেমা ৩ · ৪বি (সবচেয়ে ভালো বাংলা)",
    nameEn: "Gemma 3 4B Instruct",
    sizeMb: 2490,
    minRamMb: 6000,
    repo: "unsloth/gemma-3-4b-it-GGUF",
    file: "gemma-3-4b-it-Q4_K_M.gguf",
  },
  {
    id: "stt-bn-zipformer",
    kind: "stt",
    nameBn: "বাংলা কণ্ঠ শনাক্তকরণ",
    nameEn: "Bangla Speech Recognition",
    sizeMb: 90,
    minRamMb: 1000,
    repo: BN_STT,
    file: "tokens.txt",
    recommended: true,
    files: [
      { relativePath: "encoder.onnx", url: HF(BN_STT, "encoder.onnx") },
      { relativePath: "decoder.onnx", url: HF(BN_STT, "decoder.onnx") },
      { relativePath: "joiner.onnx", url: HF(BN_STT, "joiner.onnx") },
      { relativePath: "tokens.txt", url: HF(BN_STT, "tokens.txt") },
    ],
  },
  {
    id: "tts-bn-vits",
    kind: "tts",
    nameBn: "বাংলা কণ্ঠস্বর (উচ্চারণ)",
    nameEn: "Bangla Voice (Speech)",
    sizeMb: 110,
    minRamMb: 1000,
    repo: BN_TTS,
    file: "model.onnx",
    recommended: true,
    files: [
      { relativePath: "model.onnx", url: HF(BN_TTS, "model.onnx") },
      { relativePath: "tokens.txt", url: HF(BN_TTS, "tokens.txt") },
    ],
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
