/** Catalog of downloadable offline models (LLM / STT / vision LLM). */

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
   * Multi-file download (preferred for STT — no tar.bz2 extract on device).
   * Each file is saved under models/<id>/<relativePath>.
   */
  files?: { relativePath: string; url: string }[];
  /** Multimodal projector filename under the same model folder (vision LLM). */
  mmprojFile?: string;
  /** True when this LLM can take images via llama.rn initMultimodal. */
  multimodal?: boolean;
  /** Prompt tokens required by the GGUF's instruction template. */
  chatTemplate?: "gemma" | "chatml";
};

const HF = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${file}`;

const BN_STT = "csukuangfj2/sherpa-onnx-streaming-zipformer-bn-vosk-2026-02-09";
const PIPER_BN =
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/bn/bn_BD/google/medium/bn_BD-google-medium.onnx";
const ESPEAK_NG_DATA =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2";
const GEMMA_4B = "unsloth/gemma-3-4b-it-GGUF";
const QWEN_VL_3B = "unsloth/Qwen2.5-VL-3B-Instruct-GGUF";

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
    chatTemplate: "gemma",
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
    chatTemplate: "gemma",
  },
  {
    id: "gemma3-4b-it-q4",
    kind: "llm",
    nameBn: "জেমা ৩ · ৪বি (লেখা + ছবি)",
    nameEn: "Gemma 3 4B Instruct + Vision",
    // ~2.5 GB GGUF + ~0.85 GB mmproj
    sizeMb: 3340,
    minRamMb: 7000,
    repo: GEMMA_4B,
    file: "gemma-3-4b-it-Q4_K_M.gguf",
    mmprojFile: "mmproj-F16.gguf",
    multimodal: true,
    chatTemplate: "gemma",
    files: [
      {
        relativePath: "gemma-3-4b-it-Q4_K_M.gguf",
        url: HF(GEMMA_4B, "gemma-3-4b-it-Q4_K_M.gguf"),
      },
      {
        relativePath: "mmproj-F16.gguf",
        url: HF(GEMMA_4B, "mmproj-F16.gguf"),
      },
    ],
  },
  {
    id: "qwen25-vl-3b-it-q4",
    kind: "llm",
    nameBn: "কিউয়েন ২.৫ ভিএল · ৩বি (লেখা + ছবি)",
    nameEn: "Qwen2.5-VL 3B Instruct + Vision",
    // ~1.93 GB Q4_K_M GGUF + ~1.34 GB F16 vision projector.
    sizeMb: 3270,
    minRamMb: 7000,
    repo: QWEN_VL_3B,
    file: "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
    mmprojFile: "mmproj-F16.gguf",
    multimodal: true,
    chatTemplate: "chatml",
    files: [
      {
        relativePath: "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
        url: HF(QWEN_VL_3B, "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"),
      },
      {
        relativePath: "mmproj-F16.gguf",
        url: HF(QWEN_VL_3B, "mmproj-F16.gguf"),
      },
    ],
  },
  {
    id: "stt-bn-zipformer",
    kind: "stt",
    nameBn: "বাংলা কণ্ঠ → লেখা (স্ট্রিমিং)",
    nameEn: "Bangla Speech → Text (streaming Zipformer)",
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
    id: "tts-bn-piper",
    kind: "tts",
    nameBn: "বাংলা নারী কণ্ঠ (অফলাইন)",
    nameEn: "Bangla female voice (Piper, offline)",
    // onnx ≈ 73 MB plus shared espeak-ng-data ≈ 7 MB. No smaller Bangla Piper voice is published.
    sizeMb: 81,
    minRamMb: 512,
    repo: "rhasspy/piper-voices",
    file: "model.onnx",
    recommended: true,
    files: [
      { relativePath: "model.onnx", url: PIPER_BN },
      { relativePath: "espeak-ng-data.tar.bz2", url: ESPEAK_NG_DATA },
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

export function isMultimodalCatalogEntry(entry: ModelCatalogEntry): boolean {
  return !!(entry.multimodal && entry.mmprojFile);
}
