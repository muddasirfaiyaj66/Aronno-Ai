/**
 * On-device Gemma / Qwen GGUF via llama.rn — text + optional vision (mmproj).
 * Lazy-import native module; single-flight load so chat + models UI share one ctx.
 */
import type { LlamaContext, TokenData } from "llama.rn";
import * as FileSystem from "expo-file-system/legacy";
import {
  listInstalled,
  localMmprojPath,
  localPath,
} from "@/lib/modelManager/modelManager";
import {
  catalogById,
  isMultimodalCatalogEntry,
  type ModelCatalogEntry,
} from "@/lib/modelManager/catalog";
import { getPreferredLlmId, setPreferredLlmId } from "@/lib/modelManager/preferredLlm";
import { logMetric, markStart } from "@/lib/offline/metrics";

let ctx: LlamaContext | null = null;
let activeModelId: string | null = null;
let visionEnabled = false;
/** Single-flight so parallel ensureLlmLoaded / selectLlm don't fight. */
let loadInFlight: Promise<string | null> | null = null;

export type LlmLoadProgress = {
  modelId: string;
  phase: "starting" | "native" | "loading" | "done" | "error";
  progress?: number;
  messageBn?: string;
};

type ProgressListener = (p: LlmLoadProgress) => void;
const progressListeners = new Set<ProgressListener>();

export function subscribeLlmLoad(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

function emitProgress(p: LlmLoadProgress) {
  for (const l of progressListeners) {
    try {
      l(p);
    } catch {
      // ignore
    }
  }
}

async function getInitLlama() {
  const mod = await import("llama.rn");
  return mod.initLlama;
}

const SPECIAL_RE =
  /<\|im_start\|>\s*(assistant|user|system|model)?\s*|<start_of_turn>\s*(assistant|user|system|model)?\s*|<end_of_turn>|<\|im_end\|>|<\/?s>|<eos>|<bos>|<pad>/gi;

function stripSpecial(s: string) {
  return s.replace(SPECIAL_RE, "");
}

/** llama.rn expects a file:// URI on Android/iOS. */
export function toModelFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith("file://") || path.startsWith("content://")) return path;
  if (path.startsWith("/")) return `file://${path}`;
  return path;
}

function toFileUrl(uri: string): string {
  return toModelFileUri(uri);
}

async function releaseContext() {
  if (!ctx) return;
  try {
    if (visionEnabled) await ctx.releaseMultimodal();
  } catch {
    // ignore
  }
  try {
    await ctx.release();
  } catch {
    // ignore
  }
  ctx = null;
  activeModelId = null;
  visionEnabled = false;
}

async function resolveLoadChoice(
  preferredId?: string,
  opts?: { allowHuge?: boolean },
): Promise<ModelCatalogEntry | null> {
  const installed = (await listInstalled()).filter((e) => e.kind === "llm");
  if (!installed.length) return null;

  const savedId = preferredId ?? (await getPreferredLlmId()) ?? undefined;
  const byId = (id?: string) =>
    id ? installed.find((e) => e.id === id) : undefined;
  const lightest = [...installed].sort((a, b) => a.sizeMb - b.sizeMb)[0];
  const picked = byId(preferredId) ?? byId(savedId) ?? lightest ?? null;
  // 4B+mmproj OOMs mid-range phones unless the farmer explicitly tapped it.
  if (picked && picked.sizeMb > 1500 && !opts?.allowHuge) return lightest ?? null;
  return picked;
}

async function loadLlmEntry(
  choice: ModelCatalogEntry,
  end: (detail?: string) => void = () => undefined,
): Promise<string | null> {
  if (ctx && activeModelId === choice.id) {
    end("already-loaded");
    emitProgress({ modelId: choice.id, phase: "done", progress: 1 });
    return activeModelId;
  }

  emitProgress({
    modelId: choice.id,
    phase: "starting",
    messageBn: `${choice.nameBn} লোড শুরু…`,
  });

  await releaseContext();

  const rawPath = localPath(choice);
  const modelPath = toModelFileUri(rawPath);
  let info = await FileSystem.getInfoAsync(modelPath).catch(() => ({
    exists: false,
    size: 0,
  }));
  if (!info.exists) {
    info = await FileSystem.getInfoAsync(rawPath).catch(() => ({
      exists: false,
      size: 0,
    }));
  }
  if (!info.exists || (info.size ?? 0) < 16 * 1024 * 1024) {
    end("file-missing");
    emitProgress({
      modelId: choice.id,
      phase: "error",
      messageBn: "মডেল ফাইল পাওয়া যায়নি। আবার ডাউনলোড করুন।",
    });
    return null;
  }

  const mmprojRaw = localMmprojPath(choice);
  const mmproj = mmprojRaw ? toModelFileUri(mmprojRaw) : null;
  const wantVision = isMultimodalCatalogEntry(choice) && !!mmproj;
  let visionUnavailable = false;

  try {
    emitProgress({
      modelId: choice.id,
      phase: "native",
      messageBn: "জেমা ইঞ্জিন চালু হচ্ছে…",
    });
    const initLlama = await getInitLlama();
    emitProgress({
      modelId: choice.id,
      phase: "loading",
      progress: 0,
      messageBn: "মেমোরিতে লোড হচ্ছে — একটু অপেক্ষা করুন…",
    });

    const initParams = {
      n_ctx: wantVision ? 2048 : 1024,
      n_threads: 2,
      n_gpu_layers: 0,
      use_mlock: false,
      ctx_shift: wantVision ? false : undefined,
    };
    const onProgress = (progress: number) => {
      logMetric("llm.load.progress", progress);
      emitProgress({
        modelId: choice.id,
        phase: "loading",
        progress,
        messageBn: `লোড ${Math.round((progress ?? 0) * 100)}%…`,
      });
    };
    try {
      ctx = await initLlama({ ...initParams, model: modelPath }, onProgress);
    } catch {
      // Some Android builds only open a raw path, not file://.
      ctx = await initLlama({ ...initParams, model: rawPath }, onProgress);
    }

    if (wantVision && mmproj) {
      const ok = await ctx.initMultimodal({
        path: mmproj,
        use_gpu: false,
        image_max_tokens: 256,
      });
      visionEnabled = !!ok;
      if (ok) {
        const support = await ctx.getMultimodalSupport().catch(() => ({
          vision: false,
          audio: false,
        }));
        logMetric("llm.vision.ready", support.vision ? 1 : 0, choice.id);
      } else {
        visionUnavailable = true;
        logMetric("llm.vision.init-failed", undefined, choice.id);
      }
    }

    activeModelId = choice.id;
    await setPreferredLlmId(choice.id);
    end(choice.id);
    logMetric("llm.loaded", undefined, choice.id);
    emitProgress({
      modelId: choice.id,
      phase: "done",
      progress: 1,
      messageBn: visionUnavailable
        ? `${choice.nameBn} লেখা চালু — ছবি ইঞ্জিনে চালু হয়নি।`
        : `${choice.nameBn} চালু`,
    });
    return activeModelId;
  } catch (err) {
    await releaseContext();
    const msg = err instanceof Error ? err.message : "load-failed";
    end(msg);
    emitProgress({
      modelId: choice.id,
      phase: "error",
      messageBn:
        choice.sizeMb > 2000
          ? "লোড ব্যর্থ — RAM কম হতে পারে। ছোট মডেল (১বি) চালু করুন।"
          : "মডেল লোড যায়নি। আবার «চালু করুন» চাপুন।",
    });
    return null;
  }
}

/**
 * Load preferred / lightest installed Gemma into memory.
 */
export async function autoLoadLlm(
  preferredId?: string,
  opts?: { allowHuge?: boolean },
): Promise<string | null> {
  if (loadInFlight) return loadInFlight;

  loadInFlight = (async () => {
    const end = markStart("llm.autoload");
    try {
      const choice = await resolveLoadChoice(preferredId, opts);
      if (!choice) {
        end("none-installed");
        return null;
      }
      return await loadLlmEntry(choice, end);
    } finally {
      loadInFlight = null;
    }
  })();

  return loadInFlight;
}

export async function ensureLlmLoaded(): Promise<string | null> {
  if (ctx && activeModelId) return activeModelId;

  const first = await autoLoadLlm();
  if (first) return first;

  const installed = (await listInstalled())
    .filter((e) => e.kind === "llm")
    .sort((a, b) => a.sizeMb - b.sizeMb);

  for (const entry of installed) {
    const loaded = await autoLoadLlm(entry.id);
    if (loaded) return loaded;
  }
  return null;
}

/** Switch to a specific installed Gemma and remember the choice. */
export async function selectLlm(id: string): Promise<string | null> {
  await setPreferredLlmId(id);
  if (ctx && activeModelId === id) return id;
  if (loadInFlight) await loadInFlight.catch(() => null);
  const entry = catalogById(id);
  return autoLoadLlm(id, { allowHuge: (entry?.sizeMb ?? 0) > 1500 });
}

export function isLlmReady(): boolean {
  return ctx !== null;
}

export function isVisionLlmReady(): boolean {
  return ctx !== null && visionEnabled;
}

export function currentModelId(): string | null {
  return activeModelId;
}

export async function unloadLlm(): Promise<void> {
  if (loadInFlight) await loadInFlight.catch(() => null);
  await releaseContext();
  logMetric("llm.unload");
}

export type LlmHistoryTurn = { role: "user" | "assistant"; text: string };

function activeChatTemplate(): "gemma" | "chatml" {
  const entry = activeModelId ? catalogById(activeModelId) : undefined;
  return entry?.chatTemplate ?? "gemma";
}

function formatChatPrompt(
  promptBn: string,
  history: LlmHistoryTurn[],
): string {
  if (activeChatTemplate() === "chatml") {
    const past = history
      .slice(-4)
      .map(
        (t) =>
          `<|im_start|>${t.role === "user" ? "user" : "assistant"}\n${t.text.trim().slice(0, 400)}<|im_end|>\n`,
      )
      .join("");
    return (
      past +
      `<|im_start|>user\n${promptBn.trim()}<|im_end|>\n` +
      `<|im_start|>assistant\n`
    );
  }

  const past = history
    .slice(-4)
    .map(
      (t) =>
        `<start_of_turn>${t.role === "user" ? "user" : "model"}\n${t.text.trim().slice(0, 400)}<end_of_turn>\n`,
    )
    .join("");
  return (
    past +
    `<start_of_turn>user\n${promptBn.trim()}<end_of_turn>\n` +
    `<start_of_turn>model\n`
  );
}

async function completeOnce(
  llama: LlamaContext,
  promptBn: string,
  _userText: string,
  temperature: number,
  onToken: (t: string) => void,
  history: LlmHistoryTurn[] = [],
): Promise<boolean> {
  const prompt = formatChatPrompt(promptBn, history);

  let tagHold = "";
  let emittedAny = false;
  let raw = "";

  const flushTags = (force: boolean) => {
    if (!tagHold) return;
    if (!force && /<[|a-z_/]*$/i.test(tagHold)) return;
    const cleaned = stripSpecial(tagHold);
    tagHold = "";
    if (!cleaned) return;
    emittedAny = true;
    onToken(cleaned);
  };

  const stop = ["<end_of_turn>", "<start_of_turn>", "<|im_end|>", "<|im_start|>"];
  const sampling = {
    n_predict: 220,
    temperature,
    top_k: 40,
    top_p: 0.9,
    min_p: 0.05,
    penalty_repeat: 1.1,
    stop,
  };

  try {
    // Native chat template — small Gemma follows this more reliably than a raw prompt.
    await llama.completion(
      {
        ...sampling,
        messages: [
          ...history.slice(-4).map((t) => ({
            role: t.role === "assistant" ? "assistant" : "user",
            content: t.text.trim().slice(0, 280),
          })),
          { role: "user", content: promptBn.trim() },
        ],
      },
      (data: TokenData) => {
        const piece = data.token ?? "";
        if (!piece) return;
        raw += piece;
        tagHold += piece;
        flushTags(false);
      },
    );
  } catch {
    await llama.completion(
      {
        ...sampling,
        prompt,
      },
      (data: TokenData) => {
        const piece = data.token ?? "";
        if (!piece) return;
        raw += piece;
        tagHold += piece;
        flushTags(false);
      },
    );
  }
  flushTags(true);

  // If tag stripping ate everything, still emit raw cleaned text once.
  if (!emittedAny && raw.trim()) {
    const cleaned = stripSpecial(raw).trim();
    if (cleaned) {
      onToken(cleaned);
      emittedAny = true;
    }
  }

  return emittedAny;
}

export async function streamLlmReply(
  promptBn: string,
  onToken: (token: string) => void,
  opts: { userText?: string; history?: LlmHistoryTurn[] } = {},
): Promise<void> {
  if (!ctx) {
    throw new Error("llm-not-ready");
  }
  const end = markStart("llm.completion");
  const userText = opts.userText ?? "";
  const history = opts.history ?? [];

  if (await completeOnce(ctx, promptBn, userText, 0.2, onToken, history)) {
    end("ok");
    return;
  }

  // Retry the same grounded prompt. Do not drop app data or knowledge.
  if (await completeOnce(ctx, promptBn, userText, 0.15, onToken, history)) {
    end("ok-retry");
    return;
  }

  onToken(
    "দুঃখিত, উত্তরটি প্রস্তুত করা যায়নি। প্রশ্নটি আরেকটু স্পষ্ট করে বলুন, অথবা মডেল ম্যানেজার থেকে মডেলটি চালু আছে কিনা দেখুন।",
  );
  end("empty-fallback");
}

export async function streamLlmVisionReply(
  promptBn: string,
  imageUri: string,
  onToken: (token: string) => void = () => undefined,
): Promise<string> {
  if (!ctx || !visionEnabled) {
    throw new Error("vision-llm-not-ready");
  }
  const end = markStart("llm.vision");
  const url = toFileUrl(imageUri);
  let full = "";
  let tagHold = "";

  const flushTags = (force: boolean) => {
    if (!tagHold) return;
    if (!force && /<[|a-z_/]*$/i.test(tagHold)) return;
    const cleaned = stripSpecial(tagHold);
    tagHold = "";
    if (!cleaned) return;
    full += cleaned;
    onToken(cleaned);
  };

  try {
    await ctx.completion(
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptBn.trim() },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
        n_predict: 220,
        temperature: 0.15,
        top_k: 40,
        top_p: 0.9,
        min_p: 0.1,
        penalty_repeat: 1.1,
        stop: ["<end_of_turn>", "<start_of_turn>", "<|im_end|>", "<|im_start|>"],
      },
      (data: TokenData) => {
        const piece = data.token ?? "";
        if (!piece) return;
        tagHold += piece;
        flushTags(false);
      },
    );
    flushTags(true);
    end("ok");
    return stripSpecial(full).trim();
  } catch (err) {
    end(err instanceof Error ? err.message : "vision-failed");
    throw err;
  }
}

export async function completeLlmVision(
  promptBn: string,
  imageUri: string,
): Promise<string> {
  return streamLlmVisionReply(promptBn, imageUri);
}

export async function hasInstalledLlm(): Promise<boolean> {
  const { hasInstalledLlm: check } = await import(
    "@/lib/modelManager/modelManager"
  );
  return check();
}

export async function hasInstalledVisionLlm(): Promise<boolean> {
  const installed = await listInstalled();
  return installed.some((e) => e.kind === "llm" && isMultimodalCatalogEntry(e));
}

export async function preferredInstalledLlm(): Promise<ModelCatalogEntry | null> {
  const installed = (await listInstalled()).filter((e) => e.kind === "llm");
  if (!installed.length) return null;
  const savedId = await getPreferredLlmId();
  return (
    installed.find((e) => e.id === savedId) ??
    installed.find((e) => e.recommended) ??
    [...installed].sort((a, b) => a.sizeMb - b.sizeMb)[0] ??
    (catalogById(installed[0].id) ?? installed[0])
  );
}
