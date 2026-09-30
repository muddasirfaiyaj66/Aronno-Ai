import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { isIncomingCall, playNotificationCue } from "@/lib/notifications/alert";

const KEY = "aronno.notifications";

export type NotificationKind = "heat" | "weather" | "scan" | "order" | "admin" | "consult";

export type NotificationPriority = "normal" | "important" | "emergency";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  pathname?: string;
  params?: Record<string, string>;
  priority?: NotificationPriority;
  popup?: boolean;
  dismissed?: boolean;
};

type Snapshot = { items: AppNotification[]; unread: number };

let snapshot: Snapshot = { items: [], unread: 0 };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function countUnread(items: AppNotification[]) {
  return items.reduce((n, item) => n + (item.read ? 0 : 1), 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInbox() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

async function readStorage(): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function hydrateInbox() {
  const items = await readStorage();
  snapshot = { items, unread: countUnread(items) };
  emit();
}

export function clearInbox() {
  snapshot = { items: [], unread: 0 };
  emit();
  void AsyncStorage.removeItem(KEY).catch(() => undefined);
}

function commit(items: AppNotification[]) {
  snapshot = { items, unread: countUnread(items) };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
}

const FRESH_MS = 90_000;

function isFresh(item: AppNotification) {
  const at = Date.parse(item.createdAt);
  return Number.isFinite(at) && Date.now() - at < FRESH_MS;
}

/** Sound + vibration for notifications that just arrived. Calls ring separately. */
function alertArrivals(prev: AppNotification[], next: AppNotification[]) {
  const seen = new Set(prev.map((item) => item.id));
  const fresh = next.some(
    (item) => !seen.has(item.id) && !item.dismissed && !item.read && isFresh(item) && !isIncomingCall(item),
  );
  if (fresh) void playNotificationCue();
}

/** Server list replaces the inbox. Read state comes from the server. */
export function replaceInbox(incoming: AppNotification[]) {
  const prev = snapshot.items;
  const items = [...incoming].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  commit(items);
  alertArrivals(prev, items);
}

/** A live push from the server. The server copy wins, including read state. */
export function upsertFromServer(item: AppNotification) {
  const prev = snapshot.items;
  const items = [item, ...snapshot.items.filter((row) => row.id !== item.id)].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  commit(items);
  alertArrivals(prev, items);
}

/** Replace the inbox with the current set of alerts, keeping read state. */
export async function publishNotifications(incoming: AppNotification[]) {
  const prev = snapshot.items.length ? snapshot.items : await readStorage();
  const previous = new Map(prev.map((item) => [item.id, item]));
  const items = incoming
    .map((item) => {
      const old = previous.get(item.id);
      return {
        ...item,
        createdAt: old?.createdAt ?? item.createdAt,
        read: old?.read ?? false,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  snapshot = { items, unread: countUnread(items) };
  await AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
  emit();
}

export async function markNotificationRead(id: string) {
  const items = snapshot.items.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  snapshot = { items, unread: countUnread(items) };
  await AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
  emit();
}

export function dismissNotification(id: string) {
  const items = snapshot.items.map((item) =>
    item.id === id ? { ...item, dismissed: true } : item,
  );
  commit(items);
}

export async function markAllNotificationsRead() {
  const items = snapshot.items.map((item) => ({ ...item, read: true }));
  snapshot = { items, unread: 0 };
  await AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
  emit();
}
