/**
 * Persist which Gemma LLM the farmer wants to run.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "aronno.preferred_llm_id";

export async function getPreferredLlmId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setPreferredLlmId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEY, id);
}

export async function clearPreferredLlmId(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
