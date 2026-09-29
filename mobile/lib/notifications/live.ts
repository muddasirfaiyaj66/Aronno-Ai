import { AppState } from "react-native";
import { API_URL } from "@/services/api";
import { getCookie, getCookieHeader, ingestCookies } from "@/services/cookieJar";
import { upsertFromServer, type AppNotification, type NotificationKind } from "@/lib/notifications/inbox";

const KINDS = new Set<NotificationKind>(["heat", "weather", "scan", "order", "admin", "consult"]);

type SocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket;

function liveUrl() {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/notifications/live`;
  url.search = "";
  return url.toString();
}

function asNotification(value: unknown): AppNotification | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<AppNotification>;
  if (!row.id || !row.kind || !KINDS.has(row.kind) || !row.title || !row.body) return null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt ?? new Date().toISOString(),
    read: Boolean(row.read),
    pathname: row.pathname,
    params: row.params,
    priority:
      row.priority === "important" || row.priority === "emergency" ? row.priority : "normal",
    popup: Boolean(row.popup),
    dismissed: Boolean(row.dismissed),
  };
}

async function refreshAccess() {
  const csrf = await getCookie("aronno_csrf");
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: await getCookieHeader(),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
  });
  await ingestCookies(res);
  return res.ok;
}

/**
 * Keeps a WebSocket to the API open and writes each pushed alert into the inbox.
 * React Native's WebSocket is already in this binary, so no extra native module.
 */
export function startLiveNotifications() {
  let stopped = false;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = async () => {
    if (stopped) return;
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      return;
    }
    let cookie = await getCookieHeader();
    if (!cookie.includes("aronno_access")) {
      const refreshed = await refreshAccess().catch(() => false);
      cookie = await getCookieHeader();
      if (!refreshed || !cookie.includes("aronno_access")) {
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        attempt += 1;
        timer = setTimeout(() => {
          void connect();
        }, delay);
        return;
      }
    }
    const Socket = WebSocket as unknown as SocketCtor;
    const next = new Socket(liveUrl(), undefined, { headers: { Cookie: cookie } });
    socket = next;
    next.onopen = () => {
      attempt = 0;
    };
    next.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type?: string; item?: unknown };
        if (message.type !== "notification") return;
        const item = asNotification(message.item);
        if (item) upsertFromServer(item);
      } catch {
        // ignore a malformed frame
      }
    };
    next.onclose = (event) => {
      if (socket === next) socket = null;
      if (stopped) return;
      if (event.code === 1008) {
        void refreshAccess().catch(() => undefined);
      }
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      attempt += 1;
      timer = setTimeout(() => {
        void connect();
      }, delay);
    };
  };

  void connect();
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") void connect();
  });

  return () => {
    stopped = true;
    sub.remove();
    if (timer) clearTimeout(timer);
    socket?.close();
    socket = null;
  };
}
