/**
 * Gemini-style continuous voice conversation:
 * optional welcome → listen → reply → speak → listen again.
 */
import { listenUntilSilence } from "@/lib/offlineVoice/sttEngine";
import { speakOffline, stopOfflineSpeech } from "@/lib/offlineVoice/ttsEngine";
import { persistTurn, runLlmTurn } from "@/lib/offlineChat/chatLoop";
import { buildWelcomeBn } from "@/lib/offlineNlu/retrieve";
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
  greet?: boolean;
};

export type LiveConversationHandle = {
  stop: () => void;
};

const DEAD_MIC_TURNS_BEFORE_STOP = 3;
/** Quiet empty-transcript retries before showing a notice. */
const EMPTY_BEFORE_NOTICE = 2;
/** Gap after TTS so our own voice isn't picked up as input. */
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

    if (handlers.greet !== false && !stopped) {
      const welcome = buildWelcomeBn();
      handlers.onPhase("speaking");
      const id = handlers.onAssistantStart();
      if (handlers.onAssistantSet) handlers.onAssistantSet(id, welcome);
      else handlers.onAssistantChunk(id, welcome);
      await persistTurn("assistant", welcome);
      try {
        await speakOffline(welcome);
      } catch {
        // keep going
      }
      if (stopped) {
        handlers.onPhase("idle");
        return;
      }
      await new Promise((r) => setTimeout(r, POST_SPEECH_MS));
    }

    while (!stopped) {
      handlers.onPhase("listening");
      const session = listenUntilSilence({
        onSpeech: () => handlers.onPhase("hearing"),
        onLevel: handlers.onLevel,
      });
      cancelListen = session.cancel;
      const { text, micSilent } = await session.done;
      cancelListen = null;
      if (stopped) break;

      if (micSilent) {
        deadMicTurns += 1;
        if (deadMicTurns >= DEAD_MIC_TURNS_BEFORE_STOP) {
          handlers.onNotice?.(
            "মাইকে আওয়াজ আসছে না। ফোনে মাইকের অনুমতি দিন, অথবা এমুলেটরে Virtual microphone চালু করুন।",
          );
          break;
        }
        continue;
      }
      deadMicTurns = 0;

      const heard = text.trim();
      if (!heard) {
        emptyTurns += 1;
        if (emptyTurns >= EMPTY_BEFORE_NOTICE) {
          handlers.onNotice?.("ঠিক শুনতে পাইনি — আরেকটু স্পষ্ট করে বলুন।");
          emptyTurns = 0;
        }
        continue;
      }
      emptyTurns = 0;

      handlers.onUserFinal(heard);
      await persistTurn("user", heard);

      handlers.onPhase("thinking");
      const assistantId = handlers.onAssistantStart();
      let reply = "";
      try {
        reply = await runLlmTurn(
          heard,
          (token) => handlers.onAssistantChunk(assistantId, token),
          () => !stopped,
        );
      } catch (err) {
        handlers.onError?.(err);
        if (stopped) break;
        continue;
      }
      if (stopped) break;

      if (reply) {
        handlers.onAssistantSet?.(assistantId, reply);
        await persistTurn("assistant", reply);
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
