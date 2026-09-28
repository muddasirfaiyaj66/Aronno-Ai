/**
 * Gemini-style continuous voice conversation:
 * listen → reply → speak → listen again.
 *
 * Keep startup light: warm STT only. Do NOT load Gemma here in parallel —
 * sherpa + llama together OOMs many phones (slow, then crash).
 */
import {
  cleanSttTranscript,
  listenUntilSilence,
  warmSttForLive,
} from "@/lib/offlineVoice/sttEngine";
import { speakOffline, stopOfflineSpeech } from "@/lib/offlineVoice/ttsEngine";
import { persistTurn, runLlmTurn } from "@/lib/offlineChat/chatLoop";
import { getActiveSessionId } from "@/lib/offlineChat/sessionStore";
import { getChatSession } from "@/lib/offlineDb/queries";
import { logMetric } from "@/lib/offline/metrics";

export type LivePhase = "listening" | "hearing" | "thinking" | "speaking" | "idle";

export type LiveConversationHandlers = {
  onPhase: (phase: LivePhase) => void;
  onLevel?: (level: number) => void;
  onUserFinal: (text: string) => void;
  onAssistantStart: () => string;
  onAssistantChunk: (id: string, token: string) => void;
  onAssistantSet?: (id: string, text: string) => void;
  onNotice?: (textBn: string) => void;
  onStatus?: (textBn: string) => void;
  onError?: (err: unknown) => void;
  /** Spoken welcome removed — it delayed listen and fought the mic. */
  greet?: boolean;
};

export type LiveConversationHandle = {
  stop: () => void;
};

const POST_SPEECH_MS = 700;

export function startLiveConversation(
  handlers: LiveConversationHandlers,
): LiveConversationHandle {
  let stopped = false;
  let cancelListen: (() => void) | null = null;

  const stop = () => {
    stopped = true;
    cancelListen?.();
    cancelListen = null;
    void stopOfflineSpeech();
    handlers.onPhase("idle");
  };

  void (async () => {
    logMetric("chat.live.start");
    handlers.onPhase("thinking");
    handlers.onStatus?.("কণ্ঠ প্রস্তুত হচ্ছে…");

    const engine = await warmSttForLive();
    if (stopped) return;
    if (engine === "none") {
      handlers.onStatus?.("");
      handlers.onNotice?.(
        "কণ্ঠ চালু যায়নি। বাংলা কণ্ঠ মডেল আছে কিনা দেখুন, অথবা ইন্টারনেট চালু করুন।",
      );
      handlers.onPhase("idle");
      return;
    }

    // Gemma loads on first answer (runLlmTurn) — not together with sherpa warm.
    handlers.onStatus?.("");
    handlers.onPhase("listening");
    let silentStreak = 0;

    while (!stopped) {
      handlers.onPhase("listening");
      const session = listenUntilSilence({
        onSpeech: () => handlers.onPhase("hearing"),
        onLevel: handlers.onLevel,
        discardOnCancel: true,
      });
      cancelListen = session.cancel;
      const { text, micSilent, error } = await session.done;
      cancelListen = null;
      if (stopped) break;

      if (error === "permission") {
        handlers.onNotice?.(
          "মাইকের অনুমতি দিন, তারপর আবার কণ্ঠ চালু করুন।",
        );
        break;
      }
      if (error === "no-engine") {
        handlers.onNotice?.(
          "কণ্ঠ চালু যায়নি। বাংলা কণ্ঠ মডেল আছে কিনা দেখুন, অথবা ইন্টারনেট চালু করুন।",
        );
        break;
      }
      if (error === "record") {
        handlers.onNotice?.("মাইক চালু করা যায়নি। ফোনের সেটিংস দেখুন।");
        break;
      }

      if (micSilent) {
        silentStreak += 1;
        if (silentStreak >= 2) {
          handlers.onNotice?.(
            "মাইক থেকে শব্দ আসছে না। ফোনের মাইক চেক করুন, অথবা লিখে জিজ্ঞাসা করুন।",
          );
          break;
        }
        handlers.onStatus?.("শব্দ পাওয়া যায়নি। আরেকবার বলুন।");
        continue;
      }

      const heard = cleanSttTranscript(text).trim();
      if (!heard || heard.length < 2) {
        handlers.onStatus?.("কথা বোঝা যায়নি। আরেকটু স্পষ্ট করে বলুন।");
        continue;
      }
      silentStreak = 0;
      handlers.onStatus?.("");

      handlers.onUserFinal(heard);
      const sessionId = await getActiveSessionId();
      await persistTurn("user", heard, sessionId);

      handlers.onPhase("thinking");
      const assistantId = handlers.onAssistantStart();
      let reply = "";
      try {
        // Gemma loads here on first need — not together with sherpa at start.
        reply = await runLlmTurn(
          heard,
          (token) => handlers.onAssistantChunk(assistantId, token),
          () => !stopped,
          (msg) => {
            handlers.onStatus?.(msg);
          },
          sessionId,
        );
      } catch {
        handlers.onAssistantSet?.(
          assistantId,
          "এখন উত্তর তৈরি করা যায়নি। আবার বলুন, অথবা লিখে জিজ্ঞাসা করুন।",
        );
        if (stopped) break;
        continue;
      }
      if (stopped) break;

      if (reply && (await getChatSession(sessionId))) {
        handlers.onAssistantSet?.(assistantId, reply);
        await persistTurn("assistant", reply, sessionId);
        handlers.onPhase("speaking");
        try {
          await speakOffline(reply);
        } catch {
          // keep going
        }
      }

      await new Promise((r) => setTimeout(r, POST_SPEECH_MS));
    }

    handlers.onPhase("idle");
    logMetric("chat.live.stop");
  })();

  return { stop };
}
