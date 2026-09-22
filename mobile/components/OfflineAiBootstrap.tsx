import { useEffect } from "react";
import { autoLoadLlm } from "@/lib/modelManager/llmEngine";
import { initSTT } from "@/lib/offlineVoice/sttEngine";
import { initTTS } from "@/lib/offlineVoice/ttsEngine";
import { logMetric } from "@/lib/offline/metrics";

/**
 * On app boot: try to load any already-downloaded offline models into memory.
 * Safe no-ops when files / native modules are missing.
 */
export function OfflineAiBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const llm = await autoLoadLlm();
      if (cancelled) return;
      logMetric("boot.llm", undefined, llm ?? "none");
      await initSTT();
      await initTTS();
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
