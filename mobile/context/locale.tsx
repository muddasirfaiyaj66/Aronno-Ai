import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "bn" | "en";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (bn: string, en: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("bn");

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale((prev) => (prev === "bn" ? "en" : "bn")),
      t: (bn, en) => (locale === "bn" ? bn : en),
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
