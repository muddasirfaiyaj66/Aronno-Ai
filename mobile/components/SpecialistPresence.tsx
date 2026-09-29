import { useEffect } from "react";
import { AppState } from "react-native";
import { useAppSelector } from "@/store";
import { useGetMeQuery, useSetConsultPresenceMutation } from "@/services/api";

const SPECIALISTS = new Set(["agronomist", "extension_officer"]);

/** Approved specialists stay online for the whole time the app is in front. */
export function SpecialistPresence() {
  const authed = useAppSelector((s) => s.auth.isAuthenticated);
  const me = useAppSelector((s) => s.auth.user);
  const maybe = SPECIALISTS.has(me?.profession?.slug ?? "");
  const approved = !!me?.specialistApproved && maybe;
  useGetMeQuery(undefined, {
    skip: !authed || !maybe,
    pollingInterval: maybe ? 20_000 : 0,
  });
  const [setPresence] = useSetConsultPresenceMutation();

  useEffect(() => {
    if (!approved) return;
    let active = true;
    const beat = (online: boolean) => {
      if (!active) return;
      void setPresence({ online });
    };
    beat(AppState.currentState === "active");
    const timer = setInterval(() => beat(AppState.currentState === "active"), 15000);
    const sub = AppState.addEventListener("change", (state) => {
      beat(state === "active");
    });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
      void setPresence({ online: false });
    };
  }, [approved, setPresence]);

  return null;
}
