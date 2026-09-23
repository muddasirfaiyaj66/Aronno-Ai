/**
 * Gemini-style continuous voice conversation:
 * listen → reply → speak → listen again.
 *
 * Keep startup light: warm STT only. Do NOT load Gemma here in parallel —
 * sherpa + llama together OOMs many phones (slow, then crash).
 */
import { listenUntilSilence, warmSttForLive } from "@/lib/offlineVoice/sttEngine";
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
  onError?: (err: unknown) => void;
  /** Spoken welcome removed — it delayed listen and fought the mic. */
  greet?: boolean;
};

export type LiveConversationHandle = {
  stop: () => void;
};

const DEAD_MIC_TURNS_BEFORE_NOTICE = 4;
const EMPTY_BEFORE_NOTICE = 5;
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
    let deadMicTurns = 0;
    let emptyTurns = 0;

    const engine = await warmSttForLive();
    if (engine === "none") {
      handlers.onNotice?.(
        "কণ্ঠ চালু যায়নি। বাংলা কণ্ঠ মডেল আছে কিনা দেখুন, অথবা ইন্টারনেট চালু করুন।",
      );
      handlers.onPhase("idle");
      return;
    }

    // Gemma loads on first answer (runLlmTurn) — not together with sherpa warm.
    handlers.onPhase("listening");

    while (!stopped) {
      handlers.onPhase("listening");
      const session = listenUntilSilence({
        onSpeech: () => handlers.onPhase("hearing"),
        onLevel: handlers.onLevel,
        discardOnCancel: true,
      });
      cancelListen = session.cancel;
      const { text, micSilent } = await session.done;
      cancelListen = null;
      if (stopped) break;

      if (micSilent) {
        deadMicTurns += 1;
        if (deadMicTurns >= DEAD_MIC_TURNS_BEFORE_NOTICE) {
          handlers.onNotice?.(
            "মাইকে আওয়াজ আসছে না। ফোনে মাইকের অনুমতি দিন। অথবা লিখে জিজ্ঞাসা করুন।",
          );
          deadMicTurns = 0;
        }
        // Stay in live loop — do not stop on quiet mic.
        continue;
      }
      deadMicTurns = 0;

      const heard = text.trim();
      if (!heard) {
        emptyTurns += 1;
        if (emptyTurns >= EMPTY_BEFORE_NOTICE) {
          handlers.onNotice?.(
            "ঠিক শুনতে পাইনি — আরেকটু স্পষ্ট করে কাছে থেকে বলুন, অথবা লিখে জিজ্ঞাসা করুন।",
          );
          emptyTurns = 0;
        }
        continue;
      }
      emptyTurns = 0;

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
            if (msg) handlers.onNotice?.(msg);
          },
          sessionId,
        );
      } catch (err) {
        handlers.onError?.(err);
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
