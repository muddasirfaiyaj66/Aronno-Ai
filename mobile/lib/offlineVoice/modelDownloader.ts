/**
 * @deprecated Prefer `lib/modelManager` for all downloads (STT/TTS/LLM).
 * Thin bridge + readiness hook for older import paths.
 */
import { useCallback, useEffect, useState } from "react";
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
  const [sttReady, setSttReady] = useState(false);
  const [ttsReady, setTtsReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const stt = catalogByKind("stt")[0];
      const tts = catalogByKind("tts")[0];
      setSttReady(stt ? await isInstalled(stt) : false);
      setTtsReady(tts ? await isInstalled(tts) : false);
      await listInstalled();
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ready: sttReady && ttsReady,
    sttReady,
    ttsReady,
    refreshing,
    refresh,
  };
}
