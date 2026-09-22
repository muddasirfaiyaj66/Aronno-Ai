/**
 * On-device Gemma (GGUF) via llama.rn.
 * Requires a rebuilt expo-dev-client after installing llama.rn.
 */
import { initLlama, type LlamaContext, type TokenData } from "llama.rn";
import {
  listInstalled,
  localPath,
} from "@/lib/modelManager/modelManager";
import { catalogById, type ModelCatalogEntry } from "@/lib/modelManager/catalog";
import { logMetric, markStart } from "@/lib/offline/metrics";

let ctx: LlamaContext | null = null;
let activeModelId: string | null = null;

/**
 * Call at app start and after an LLM download finishes.
 * Prefers `preferredId`, else recommended installed, else first installed LLM.
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

  const choice: ModelCatalogEntry =
    installed.find((e) => e.id === preferredId) ??
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
        n_gpu_layers: 99,
      },
      (progress) => {
        logMetric("llm.load.progress", progress);
      },
    );
    activeModelId = choice.id;
    end(choice.id);
    logMetric("llm.loaded", undefined, choice.id);
    return activeModelId;
  } catch (err) {
    ctx = null;
    activeModelId = null;
    end(err instanceof Error ? err.message : "load-failed");
    return null;
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

export async function streamLlmReply(
  promptBn: string,
  onToken: (t: string) => void,
): Promise<void> {
  if (!ctx) {
    throw new Error(
      "no LLM loaded — open Model Manager and download Gemma first",
    );
  }
  const end = markStart("llm.completion");
  await ctx.completion(
    {
      messages: [{ role: "user", content: promptBn }],
      n_predict: 256,
      temperature: 0.4,
      stop: ["<end_of_turn>"],
    },
    (data: TokenData) => {
      if (data.token) onToken(data.token);
    },
  );
  end("ok");
}

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
