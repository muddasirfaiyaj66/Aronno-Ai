/**
 * Active chat conversation id (persisted) + light topic memory for follow-ups.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatTopic } from "@/lib/offlineChat/intents";
import {
  createChatSession,
  ensureActiveChatSession,
  getChatSession,
  touchChatSession,
} from "@/lib/offlineDb/queries";

const ACTIVE_KEY = "aronno.chat.activeSessionId";
const TOPIC_PREFIX = "aronno.chat.topic.";

let memorySessionId: string | null = null;
const topicBySession = new Map<string, ChatTopic>();

export async function getActiveSessionId(): Promise<string> {
  if (memorySessionId) return memorySessionId;
  const saved = await AsyncStorage.getItem(ACTIVE_KEY);
  if (saved) {
    const exists = await getChatSession(saved).catch(() => null);
    if (exists) {
      memorySessionId = saved;
      return saved;
    }
  }
  const id = await ensureActiveChatSession();
  memorySessionId = id;
  await AsyncStorage.setItem(ACTIVE_KEY, id);
  return id;
}

export async function setActiveSessionId(id: string): Promise<void> {
  memorySessionId = id;
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

export async function startNewChatSession(): Promise<string> {
  const id = await createChatSession("নতুন আলোচনা");
  await setActiveSessionId(id);
  topicBySession.delete(id);
  await AsyncStorage.removeItem(TOPIC_PREFIX + id).catch(() => undefined);
  return id;
}

export async function switchChatSession(id: string): Promise<void> {
  await setActiveSessionId(id);
  await touchChatSession(id).catch(() => undefined);
}

export async function getSessionTopic(sessionId?: string): Promise<ChatTopic | undefined> {
  const id = sessionId ?? (await getActiveSessionId());
  if (topicBySession.has(id)) return topicBySession.get(id);
  try {
    const raw = await AsyncStorage.getItem(TOPIC_PREFIX + id);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ChatTopic;
    topicBySession.set(id, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

export async function setSessionTopic(
  topic: ChatTopic | undefined,
  sessionId?: string,
): Promise<void> {
  const id = sessionId ?? (await getActiveSessionId());
  if (!topic) {
    topicBySession.delete(id);
    await AsyncStorage.removeItem(TOPIC_PREFIX + id).catch(() => undefined);
    return;
  }
  topicBySession.set(id, topic);
  await AsyncStorage.setItem(TOPIC_PREFIX + id, JSON.stringify(topic)).catch(
    () => undefined,
  );
}

export function titleFromUserText(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "নতুন আলোচনা";
  return t.length > 36 ? `${t.slice(0, 36)}…` : t;
}
