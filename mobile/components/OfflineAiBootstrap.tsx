import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { initOfflineDb } from "@/lib/offlineDb/db";
import { runSync, requestSyncSoon } from "@/lib/offlineDb/syncEngine";
import { fetchIsOnline } from "@/hooks/useIsOnline";
import { ensureBundledVisionInstalled } from "@/lib/offlineVision/paths";

/**
 * On app boot: init SQLite, seed bundled vision models, kick sync when online.
 * Do NOT eagerly init llama / sherpa STT+TTS here — a native abort in
 * sherpa-onnx TTS kills the whole process (uncaught SIGABRT) and looks like
 * the app "closing again and again". Those engines lazy-load on first use.
 */
export function OfflineAiBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let wasOnline: boolean | null = null;

    (async () => {
      await initOfflineDb().catch(() => undefined);
      if (cancelled) return;
      await ensureBundledVisionInstalled().catch(() => undefined);
      if (cancelled) return;
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
