import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { autoLoadLlm } from "@/lib/modelManager/llmEngine";
import { initSTT } from "@/lib/offlineVoice/sttEngine";
import { initTTS } from "@/lib/offlineVoice/ttsEngine";
import { initOfflineDb } from "@/lib/offlineDb/db";
import { runSync, requestSyncSoon } from "@/lib/offlineDb/syncEngine";
import { logMetric } from "@/lib/offline/metrics";
import { fetchIsOnline } from "@/hooks/useIsOnline";

/**
 * On app boot: init SQLite, load offline models, kick sync when online.
 */
export function OfflineAiBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let wasOnline: boolean | null = null;

    (async () => {
      await initOfflineDb().catch(() => undefined);
      if (cancelled) return;
      const llm = await autoLoadLlm();
      if (cancelled) return;
      logMetric("boot.llm", undefined, llm ?? "none");
      await initSTT();
      await initTTS();
      if (await fetchIsOnline()) {
        requestSyncSoon(800);
      }
    })().catch(() => undefined);

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void fetchIsOnline().then((on) => {
          if (on) void runSync();
        });
      }
    });

    const netSub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      if (wasOnline === false && online) {
        requestSyncSoon(400);
      }
      wasOnline = online;
    });

    return () => {
      cancelled = true;
      appSub.remove();
      netSub();
    };
  }, []);
  return null;
}
