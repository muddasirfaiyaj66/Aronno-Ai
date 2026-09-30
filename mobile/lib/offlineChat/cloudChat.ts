/**
 * Which online model answers: Google's free Gemini API when
 * EXPO_PUBLIC_GEMINI_API_KEY is set, otherwise Ollama cloud Gemma.
 */
import type { LlmHistoryTurn } from "@/lib/modelManager/llmEngine";
import { hasGeminiKey, streamCloudGemini } from "@/lib/offlineChat/cloudGemini";
import { hasOllamaKey, streamCloudGemma } from "@/lib/offlineChat/cloudGemma";

export function hasCloudChatKey(): boolean {
  return hasGeminiKey() || hasOllamaKey();
}

export function streamCloudReply(
  userText: string,
  history: LlmHistoryTurn[],
  facts: string[],
  onToken: (token: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<string> {
  return hasGeminiKey()
    ? streamCloudGemini(userText, history, facts, onToken, shouldContinue)
    : streamCloudGemma(userText, history, facts, onToken, shouldContinue);
}
