import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Locale = "bn" | "en";

const STORAGE_KEY = "aronno.locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (bn: string, en: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** In memory too, so a theme-switch remount keeps the choice instantly. */
let remembered: Locale = "bn";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(remembered);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "bn" || stored === "en") {
          remembered = stored;
          setLocaleState(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const setLocale = (next: Locale) => {
      remembered = next;
      setLocaleState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    };
    return {
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === "bn" ? "en" : "bn"),
      t: (bn, en) => (locale === "bn" ? bn : en),
    };
  }, [locale]);

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
