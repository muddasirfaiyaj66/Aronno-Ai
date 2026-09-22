/**
 * Offline realtime chat: STT → grounded Gemma LLM → sentence-chunked TTS.
 */
import { startListening } from "@/lib/offlineVoice/sttEngine";
import { streamOffline } from "@/lib/offlineVoice/ttsEngine";
import { retrieveContext } from "@/lib/offlineNlu/retrieve";
import { isLlmReady, streamLlmReply } from "@/lib/modelManager/llmEngine";

export const SYSTEM_PROMPT_BN =
  "তুমি আরণ্য, বাংলাদেশের কৃষকদের জন্য একজন সহায়ক কৃষি সহকারী। " +
  "সবসময় সহজ, সংক্ষিপ্ত বাংলায় উত্তর দাও। নিচের তথ্য সঠিক হিসেবে ব্যবহার করো, " +
  "এর বাইরে অনুমান করে ওষুধ বা মাত্রা বলো না, অনিশ্চিত হলে কৃষি সম্প্রসারণ অফিসে যোগাযোগের পরামর্শ দাও।";

export function buildGroundedPrompt(
  userTextBn: string,
  extraContext: string[] = [],
): string {
  const context = [...retrieveContext(userTextBn), ...extraContext].slice(0, 3);
  return [
    SYSTEM_PROMPT_BN,
    context.length ? `প্রাসঙ্গিক তথ্য:\n${context.join("\n")}` : "",
    `কৃষকের প্রশ্ন: ${userTextBn}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type ChatTurnHandlers = {
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onTextChunk: (token: string) => void;
  onDone: () => void;
  onError?: (err: unknown) => void;
};

/**
 * Starts mic listening; on final STT runs the LLM and streams TTS per sentence.
 * Returns a stop function.
 */
export function startChatTurn(handlers: ChatTurnHandlers): () => void {
  return startListening(
    (partial) => handlers.onPartialTranscript?.(partial),
    async (finalTextBn) => {
      handlers.onFinalTranscript?.(finalTextBn);
      if (!isLlmReady()) {
        handlers.onError?.(new Error("llm-not-ready"));
        handlers.onDone();
        return;
      }
      try {
        const prompt = buildGroundedPrompt(finalTextBn);
        let sentenceBuffer = "";
        await streamLlmReply(prompt, (token) => {
          sentenceBuffer += token;
          handlers.onTextChunk(token);
          if (/[।.!?]/.test(token)) {
            void streamOffline(sentenceBuffer);
            sentenceBuffer = "";
          }
        });
        if (sentenceBuffer.trim()) {
          void streamOffline(sentenceBuffer);
        }
      } catch (err) {
        handlers.onError?.(err);
      } finally {
        handlers.onDone();
      }
    },
  );
}
