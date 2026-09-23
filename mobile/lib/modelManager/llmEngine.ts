/**
 * On-device Gemma IT (GGUF) via llama.rn — text + optional vision (mmproj).
 */
import { NativeModules, TurboModuleRegistry } from "react-native";
type LlamaContext = import("llama.rn").LlamaContext;
type TokenData = import("llama.rn").TokenData;
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

function getInitLlama() {
  try {
    const hasTurbo =
      typeof TurboModuleRegistry !== "undefined" &&
      !!TurboModuleRegistry.get &&
      !!(
        TurboModuleRegistry.get("LlamaContext") ||
        TurboModuleRegistry.get("LlamaBridge") ||
        TurboModuleRegistry.get("RNLlama")
      );
    const hasNative =
      !!NativeModules &&
      !!(
        NativeModules.LlamaContext ||
        NativeModules.LlamaBridge ||
        NativeModules.RNLlama
      );
    if (!hasTurbo && !hasNative) return null;
    const mod = require("llama.rn");
    return mod.initLlama ?? null;
  } catch {
    return null;
  }
}

let ctx: LlamaContext | null = null;
let activeModelId: string | null = null;
let visionEnabled = false;

const SPECIAL_RE =
  /<\|im_start\|>\s*(assistant|user|system|model)?\s*|<start_of_turn>\s*(assistant|user|system|model)?\s*|<end_of_turn>|<\|im_end\|>|<\/?s>|<eos>|<bos>|<pad>/gi;

function stripSpecial(s: string) {
  return s.replace(SPECIAL_RE, "");
}

function toFileUrl(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith("file://") || uri.startsWith("data:")) return uri;
  if (uri.startsWith("/")) return `file://${uri}`;
  return uri;
}

async function releaseContext() {
  if (!ctx) return;
  try {
    if (visionEnabled) await ctx.releaseMultimodal();
  } catch {
    // ignore
  }
  await ctx.release();
  ctx = null;
  activeModelId = null;
  visionEnabled = false;
}

/**
 * Call at app start and after an LLM download finishes.
 * Order: explicit preferredId → saved preference → multimodal → recommended → first.
 */
export async function autoLoadLlm(
  preferredId?: string,
): Promise<string | null> {
  const end = markStart("llm.autoload");
  const installed = (await listInstalled()).filter((e) => e.kind === "llm");
  if (!installed.length) {
    end("none-installed");
    return null;
  }

  const savedId = preferredId ?? (await getPreferredLlmId()) ?? undefined;
  const choice: ModelCatalogEntry =
    installed.find((e) => e.id === savedId) ??
    installed.find((e) => isMultimodalCatalogEntry(e)) ??
    installed.find((e) => e.recommended) ??
    installed[0];

  if (ctx && activeModelId === choice.id) {
    end("already-loaded");
    return activeModelId;
  }

  await releaseContext();

  const modelPath = localPath(choice);
  const mmproj = localMmprojPath(choice);
  const wantVision = isMultimodalCatalogEntry(choice) && !!mmproj;

  const initLlama = getInitLlama();
  if (!initLlama) {
    end("native-module-missing");
    return null;
  }

  try {
    ctx = await initLlama(
      {
        model: modelPath,
        n_ctx: wantVision ? 4096 : 2048,
        n_threads: 4,
        n_gpu_layers: 0,
        // Required so media token positions stay valid.
        ctx_shift: wantVision ? false : undefined,
      },
      (progress: number) => {
        logMetric("llm.load.progress", progress);
      },
    );

    if (wantVision && mmproj && ctx) {
      const ok = await ctx.initMultimodal({
        path: mmproj,
        use_gpu: false,
        // Keep image tokens modest for phone RAM.
        image_max_tokens: 256,
      });
      visionEnabled = !!ok;
      if (ok && ctx) {
        const support = await ctx.getMultimodalSupport().catch(() => ({
          vision: false,
          audio: false,
        }));
        logMetric(
          "llm.vision.ready",
          support.vision ? 1 : 0,
          choice.id,
        );
      } else {
        logMetric("llm.vision.init-failed", undefined, choice.id);
      }
    }

    activeModelId = choice.id;
    await setPreferredLlmId(choice.id);
    end(choice.id);
    logMetric("llm.loaded", undefined, choice.id);
    return activeModelId;
  } catch (err) {
    await releaseContext();
    end(err instanceof Error ? err.message : "load-failed");
    return null;
  }
}

/** Switch to a specific installed Gemma and remember the choice. */
export async function selectLlm(id: string): Promise<string | null> {
  await setPreferredLlmId(id);
  return autoLoadLlm(id);
}

export function isLlmReady(): boolean {
  return ctx !== null;
}

/** True when loaded LLM has mmproj vision enabled. */
export function isVisionLlmReady(): boolean {
  return ctx !== null && visionEnabled;
}

export function currentModelId(): string | null {
  return activeModelId;
}

export async function unloadLlm(): Promise<void> {
  await releaseContext();
  logMetric("llm.unload");
}

function normForEcho(s: string) {
  return s.toLowerCase().replace(/[\s।,.!?"'«»:;\-–—()]/g, "");
}

export type LlmHistoryTurn = { role: "user" | "assistant"; text: string };

async function completeOnce(
  llama: LlamaContext,
  promptBn: string,
  userText: string,
  temperature: number,
  onToken: (t: string) => void,
  history: LlmHistoryTurn[] = [],
): Promise<boolean> {
  const past = history
    .map(
      (t) =>
        `<start_of_turn>${t.role === "user" ? "user" : "model"}\n${t.text.trim()}<end_of_turn>\n`,
    )
    .join("");
  const prompt =
    past +
    `<start_of_turn>user\n${promptBn.trim()}<end_of_turn>\n` +
    `<start_of_turn>model\n`;

  const question = normForEcho(userText);
  let tagHold = "";
  let echoHold = "";
  let gated = question.length > 0;
  let emittedAny = false;

  const emit = (text: string) => {
    if (!text) return;
    if (!gated) {
      emittedAny = true;
      onToken(text);
      return;
    }
    echoHold += text;
    const held = normForEcho(echoHold);
    const stillEcho =
      question.startsWith(held) ||
      (held.startsWith(question) && held.length <= question.length + 6);
    if (!stillEcho) {
      gated = false;
      emittedAny = true;
      onToken(echoHold);
      echoHold = "";
    }
  };

  const flushTags = (force: boolean) => {
    if (!tagHold) return;
    if (!force && /<[|a-z_/]*$/i.test(tagHold)) return;
    const cleaned = stripSpecial(tagHold);
    tagHold = "";
    emit(cleaned);
  };

  await llama.completion(
    {
      prompt,
      n_predict: 160,
      temperature,
      top_k: 40,
      top_p: 0.9,
      min_p: 0.1,
      penalty_repeat: 1.15,
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

  return emittedAny && !gated;
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

  if (await completeOnce(ctx, promptBn, userText, 0.25, onToken, history)) {
    end("ok");
    return;
  }

  const firmer =
    `${promptBn.trim()}\nশুধু উত্তর। তথ্য না থাকলে লিখুন: এই বিষয়ে নিশ্চিত তথ্য নেই। প্রশ্ন আবার লিখবেন না।`;
  if (await completeOnce(ctx, firmer, userText, 0.15, onToken)) {
    end("ok-retry");
    return;
  }

  onToken("এই বিষয়ে নিশ্চিত তথ্য নেই।");
  end("echo-fallback");
}

/**
 * Vision completion — requires multimodal Gemma (mmproj loaded).
 * Streams Bangla/text tokens; returns full cleaned string.
 */
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

/** Collect full vision reply without streaming UI. */
export async function completeLlmVision(
  promptBn: string,
  imageUri: string,
): Promise<string> {
  return streamLlmVisionReply(promptBn, imageUri);
}

export async function hasInstalledLlm(): Promise<boolean> {
  const llms = (await listInstalled()).filter((e) => e.kind === "llm");
  return llms.length > 0;
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
    installed.find((e) => isMultimodalCatalogEntry(e)) ??
    installed.find((e) => e.recommended) ??
    (catalogById(installed[0].id) ?? installed[0])
  );
}
