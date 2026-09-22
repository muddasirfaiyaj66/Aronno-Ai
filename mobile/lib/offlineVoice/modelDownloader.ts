/**
 * @deprecated Prefer `lib/modelManager` for all downloads (STT/TTS/LLM).
 * Thin bridge kept so older Sprint 0 import paths still resolve.
 */
import { catalogByKind } from "@/lib/modelManager/catalog";
import {
  downloadModel,
  isInstalled,
  listInstalled,
} from "@/lib/modelManager/modelManager";

export type DownloadProgress = {
  bytesWritten: number;
  totalBytes: number | null;
  fraction: number | null;
};

export async function ensureOfflineModels(
  onProgress?: (p: DownloadProgress) => void,
): Promise<{ sttReady: boolean; ttsReady: boolean }> {
  const stt = catalogByKind("stt")[0];
  const tts = catalogByKind("tts")[0];
  let sttReady = stt ? await isInstalled(stt) : false;
  let ttsReady = tts ? await isInstalled(tts) : false;

  if (stt && !sttReady) {
    await downloadModel(stt, (fraction) =>
      onProgress?.({ bytesWritten: 0, totalBytes: null, fraction }),
    );
    sttReady = true;
  }
  if (tts && !ttsReady) {
    await downloadModel(tts, (fraction) =>
      onProgress?.({ bytesWritten: 0, totalBytes: null, fraction }),
    );
    ttsReady = true;
  }
  return { sttReady, ttsReady };
}

export function useOfflineModelsReady(): {
  ready: boolean;
  sttReady: boolean;
  ttsReady: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
} {
  // Full hook lands with Model Manager UI; stub keeps imports compiling.
  return {
    ready: false,
    sttReady: false,
    ttsReady: false,
    refreshing: false,
    refresh: async () => {
      await listInstalled();
    },
  };
}
