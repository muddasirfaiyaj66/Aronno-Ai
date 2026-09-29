import { useEffect, useRef } from "react";
import { useAppSelector } from "@/store";
import { useFarmLocation } from "@/hooks/useFarmLocation";
import { distanceMeters } from "@/lib/heatZone";
import {
  clearInbox,
  replaceInbox,
  type AppNotification,
} from "@/lib/notifications/inbox";
import { startLiveNotifications } from "@/lib/notifications/live";
import {
  useGetNotificationsQuery,
  useSyncNotificationLocationMutation,
} from "@/services/api";
import { AdminNotice } from "@/components/AdminNotice";

const KINDS = new Set<AppNotification["kind"]>(["heat", "weather", "scan", "order", "admin", "consult"]);

function asList(value: unknown): AppNotification[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is AppNotification => {
    if (!row || typeof row !== "object") return false;
    const item = row as AppNotification;
    return Boolean(item.id && item.title && item.body && KINDS.has(item.kind));
  });
}

/**
 * Loads the server inbox and keeps a live socket open.
 * GPS is posted so the server can match this phone to a heat-map radius.
 */
export function NotificationSync() {
  const authed = useAppSelector((s) => s.auth.isAuthenticated);
  const location = useFarmLocation();
  const { data } = useGetNotificationsQuery(undefined, {
    skip: !authed,
    pollingInterval: authed ? 20_000 : 0,
  });
  const [syncLocation] = useSyncNotificationLocationMutation();
  const lastSent = useRef<{ lat: number; lon: number; at: number } | null>(null);
  const wasAuthed = useRef(false);
  const coordsRef = useRef(location.coords);
  coordsRef.current = location.coords;

  useEffect(() => {
    if (!authed) {
      if (wasAuthed.current) clearInbox();
      wasAuthed.current = false;
      return;
    }
    wasAuthed.current = true;
    return startLiveNotifications();
  }, [authed]);

  useEffect(() => {
    if (!authed || !data) return;
    replaceInbox(asList(data));
  }, [authed, data]);

  const hasCoords = location.coords != null;

  useEffect(() => {
    if (!authed || !hasCoords) return;
    const send = () => {
      const here = coordsRef.current;
      if (!here) return;
      const prev = lastSent.current;
      if (prev && Date.now() - prev.at < 60_000 && distanceMeters(prev, here) < 400) return;
      lastSent.current = { lat: here.lat, lon: here.lon, at: Date.now() };
      void syncLocation({ lat: here.lat, lon: here.lon });
    };
    const first = setTimeout(send, 1500);
    const interval = setInterval(send, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [authed, hasCoords, syncLocation]);

  return <AdminNotice />;
}
