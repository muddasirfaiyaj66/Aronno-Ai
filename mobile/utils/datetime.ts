import type { Locale } from "@/context/locale";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toLocaleDigits(value: string | number, locale: Locale) {
  const text = String(value);
  if (locale !== "bn") return text;
  return text.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatHomeDate(date: Date, locale: Locale) {
  const formatted = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted;
}

export function formatHomeTime(date: Date, locale: Locale) {
  const formatted = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return formatted;
}
