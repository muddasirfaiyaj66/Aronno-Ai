/**
 * On-device Gemma (GGUF) via llama.rn.
 * Package not installed yet — stubs compile; wire initLlama after `pnpm add llama.rn`.
 */
import {
  isInstalled,
  listInstalled,
  localPath,
} from "@/lib/modelManager/modelManager";
import { catalogById, type ModelCatalogEntry } from "@/lib/modelManager/catalog";

type CompletionCallback = (data: { token: string }) => void;

type LlamaContextLike = {
  release: () => Promise<void>;
  completion: (
    params: {
      messages: { role: string; content: string }[];
      n_predict: number;
      temperature: number;
      stop?: string[];
    },
    onToken?: CompletionCallback,
  ) => Promise<unknown>;
};

let ctx: LlamaContextLike | null = null;
let activeModelId: string | null = null;

async function tryInitLlama(modelPath: string): Promise<LlamaContextLike> {
  // Dynamic import so the app boots before llama.rn is installed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("llama.rn") as {
    initLlama: (opts: {
      model: string;
      n_ctx: number;
      n_threads: number;
    }) => Promise<LlamaContextLike>;
  };
  return mod.initLlama({ model: modelPath, n_ctx: 2048, n_threads: 4 });
}

/**
 * Call at app start and after an LLM download finishes.
 * Prefers `preferredId`, else recommended installed, else first installed LLM.
 */
export async function autoLoadLlm(
  preferredId?: string,
): Promise<string | null> {
  const installed = (await listInstalled()).filter((e) => e.kind === "llm");
  if (!installed.length) return null;

  const choice: ModelCatalogEntry =
    installed.find((e) => e.id === preferredId) ??
    installed.find((e) => e.recommended) ??
    installed[0];

  if (ctx && activeModelId === choice.id) return activeModelId;

  if (ctx) {
    await ctx.release();
    ctx = null;
    activeModelId = null;
  }

  const modelPath = localPath(choice);
  try {
    ctx = await tryInitLlama(modelPath);
    activeModelId = choice.id;
    return activeModelId;
  } catch {
    // llama.rn missing or model file corrupt — leave unloaded
    ctx = null;
    activeModelId = null;
    return null;
  }
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
}

export async function streamLlmReply(
  promptBn: string,
  onToken: (t: string) => void,
): Promise<void> {
  if (!ctx) {
    throw new Error(
      "no LLM loaded — open Model Manager and download Gemma first",
    );
  }
  await ctx.completion(
    {
      messages: [{ role: "user", content: promptBn }],
      n_predict: 256,
      temperature: 0.4,
      stop: ["<end_of_turn>"],
    },
    (data) => onToken(data.token),
  );
}

/** True if any catalog LLM file is on disk (even if not loaded into RAM). */
export async function hasInstalledLlm(): Promise<boolean> {
  const llms = (await listInstalled()).filter((e) => e.kind === "llm");
  return llms.length > 0;
}

export async function preferredInstalledLlm(): Promise<ModelCatalogEntry | null> {
  const installed = (await listInstalled()).filter((e) => e.kind === "llm");
  if (!installed.length) return null;
  return (
    installed.find((e) => e.recommended) ??
    (catalogById(installed[0].id) ?? installed[0])
  );
}

export { isInstalled };
