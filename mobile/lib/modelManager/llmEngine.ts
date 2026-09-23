/**
 * On-device Gemma IT (GGUF) via llama.rn.
 */
import {
  initLlama,
  type LlamaContext,
  type TokenData,
} from "llama.rn";
import {
  listInstalled,
  localPath,
} from "@/lib/modelManager/modelManager";
import { catalogById, type ModelCatalogEntry } from "@/lib/modelManager/catalog";
import { getPreferredLlmId, setPreferredLlmId } from "@/lib/modelManager/preferredLlm";
import { logMetric, markStart } from "@/lib/offline/metrics";

let ctx: LlamaContext | null = null;
let activeModelId: string | null = null;

const SPECIAL_RE =
  /<\|im_start\|>\s*(assistant|user|system|model)?\s*|<start_of_turn>\s*(assistant|user|system|model)?\s*|<end_of_turn>|<\|im_end\|>|<\/?s>|<eos>|<bos>|<pad>/gi;

function stripSpecial(s: string) {
  return s.replace(SPECIAL_RE, "");
}

/**
 * Call at app start and after an LLM download finishes.
 * Order: explicit preferredId → saved preference → recommended → first installed.
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
    installed.find((e) => e.recommended) ??
    installed[0];

  if (ctx && activeModelId === choice.id) {
    end("already-loaded");
    return activeModelId;
  }

  if (ctx) {
    await ctx.release();
    ctx = null;
    activeModelId = null;
  }

  const modelPath = localPath(choice);
  try {
    ctx = await initLlama(
      {
        model: modelPath,
        n_ctx: 2048,
        n_threads: 4,
        n_gpu_layers: 0,
      },
      (progress) => {
        logMetric("llm.load.progress", progress);
      },
    );
    activeModelId = choice.id;
    await setPreferredLlmId(choice.id);
    end(choice.id);
    logMetric("llm.loaded", undefined, choice.id);
    return activeModelId;
  } catch (err) {
    ctx = null;
    activeModelId = null;
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

export function currentModelId(): string | null {
  return activeModelId;
}

export async function unloadLlm(): Promise<void> {
  if (ctx) await ctx.release();
  ctx = null;
  activeModelId = null;
  logMetric("llm.unload");
}

function normForEcho(s: string) {
  return s.toLowerCase().replace(/[\s।,.!?"'«»:;\-–—()]/g, "");
}

/**
 * One completion pass. Text is held back while it still looks like a copy of
 * the user's question, so echoes never reach the UI.
 * Returns true if the model produced a real (non-echo) answer.
 */
export type LlmHistoryTurn = { role: "user" | "assistant"; text: string };

async function completeOnce(
  llama: LlamaContext,
  promptBn: string,
  userText: string,
  temperature: number,
  onToken: (t: string) => void,
  history: LlmHistoryTurn[] = [],
): Promise<boolean> {
  // Official Gemma 3 Instruct turn format (llama.cpp adds <bos> itself).
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
      n_predict: 120,
      temperature,
      top_k: 64,
      top_p: 0.95,
      min_p: 0.05,
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

  return emittedAny && !gated;
}

export async function streamLlmReply(
  promptBn: string,
  onToken: (t: string) => void,
  opts: { userText?: string; history?: LlmHistoryTurn[] } = {},
): Promise<void> {
  if (!ctx) {
    throw new Error("llm-not-ready");
  }
  const end = markStart("llm.completion");
  const userText = opts.userText ?? "";
  const history = opts.history ?? [];

  if (await completeOnce(ctx, promptBn, userText, 0.5, onToken, history)) {
    end("ok");
    return;
  }

  // Small models often just repeat the question — retry once, no history, firmer ask.
  const firmer =
    `${promptBn.trim()}\nশুধু উত্তর লেখো। ২টি ছোট বাক্য। প্রশ্ন আবার লিখবে না।`;
  if (await completeOnce(ctx, firmer, userText, 0.35, onToken)) {
    end("ok-retry");
    return;
  }

  onToken(
    activeModelId === "gemma3-270m-q8"
      ? "ছোট মডেলটি উত্তর দিতে পারছে না। মডেল ম্যানেজার থেকে «জেমা ৩ (মাঝারি)» ডাউনলোড করুন — বাংলায় অনেক ভালো কথা বলে।"
      : "দুঃখিত, বুঝতে পারিনি। একটু অন্যভাবে আবার বলুন।",
  );
  end("echo-fallback");
}

export async function hasInstalledLlm(): Promise<boolean> {
  const llms = (await listInstalled()).filter((e) => e.kind === "llm");
  return llms.length > 0;
}

export async function preferredInstalledLlm(): Promise<ModelCatalogEntry | null> {
  const installed = (await listInstalled()).filter((e) => e.kind === "llm");
  if (!installed.length) return null;
  const savedId = await getPreferredLlmId();
  return (
    installed.find((e) => e.id === savedId) ??
    installed.find((e) => e.recommended) ??
    (catalogById(installed[0].id) ?? installed[0])
  );
}
