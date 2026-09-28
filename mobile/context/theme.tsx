import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import { colorScheme as nativewindScheme } from "nativewind";
import {
  colors,
  darkColors,
  lightColors,
  paletteVars,
  setActivePalette,
  type Palette,
} from "@/constants/theme";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "aronno.theme";

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: "light" | "dark";
  colors: Palette;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function resolveScheme(
  preference: ThemePreference,
  system: "light" | "dark" | null | undefined,
): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return system === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [system, setSystem] = useState(Appearance.getColorScheme());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme: next }) => {
      setSystem(next);
    });
    return () => sub.remove();
  }, []);

  const scheme = resolveScheme(preference, system);
  const palette = scheme === "dark" ? darkColors : lightColors;
  setActivePalette(palette);

  useEffect(() => {
    nativewindScheme.set(preference);
    Appearance.setColorScheme(preference === "system" ? null : preference);
    SystemUI.setBackgroundColorAsync(palette.neutral).catch(() => undefined);
  }, [preference, palette.neutral]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, colors: palette, setPreference }),
    [preference, scheme, palette],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: palette.neutral }, paletteVars(palette)]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

/** Active palette. Subscribes to theme changes. */
export function useColors() {
  return useTheme().colors;
}

export { colors };
