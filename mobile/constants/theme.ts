import { vars } from "nativewind";

export type Palette = {
  primary: string;
  secondary: string;
  tertiary: string;
  neutral: string;
  neutral100: string;
  neutral200: string;
  neutral300: string;
  neutral400: string;
  card: string;
  forest700: string;
  forest600: string;
  forest900: string;
  leaf400: string;
  harvest: string;
  harvestSoft: string;
  sand: string;
  ink: string;
  muted: string;
  accent: string;
  white: string;
  border: string;
  danger: string;
  dangerSoft: string;
};

export const lightColors: Palette = {
  primary: "#0F766E",
  secondary: "#E7F5F2",
  tertiary: "#14967A",
  neutral: "#F4F7F6",
  neutral100: "#E7EEEB",
  neutral200: "#D7E3DE",
  neutral300: "#C1CBC5",
  neutral400: "#8A9690",
  card: "#FFFFFF",
  forest700: "#0F766E",
  forest600: "#14967A",
  forest900: "#115E59",
  leaf400: "#2A9D8F",
  harvest: "#C4841D",
  harvestSoft: "#FBF4E6",
  sand: "#F4F7F6",
  ink: "#13241F",
  muted: "#5C6E68",
  accent: "#14967A",
  white: "#FFFFFF",
  border: "#D7E3DE",
  danger: "#B42318",
  dangerSoft: "#FEF3F2",
};

export const darkColors: Palette = {
  primary: "#5EEAD4",
  secondary: "#1C3330",
  tertiary: "#14967A",
  neutral: "#0C1614",
  neutral100: "#13211E",
  neutral200: "#243832",
  neutral300: "#3D524C",
  neutral400: "#8AA39B",
  card: "#162420",
  forest700: "#0F766E",
  forest600: "#14967A",
  forest900: "#115E59",
  leaf400: "#5EEAD4",
  harvest: "#E8B04A",
  harvestSoft: "#3A2E18",
  sand: "#0C1614",
  ink: "#E7F3EF",
  muted: "#A8B8B2",
  accent: "#5EEAD4",
  white: "#FFFFFF",
  border: "#2A403A",
  danger: "#F97066",
  dangerSoft: "#3A1D1B",
};

let active: Palette = lightColors;

export function setActivePalette(palette: Palette) {
  active = palette;
}

function channel(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** CSS variables consumed by Tailwind color tokens. */
export function paletteVars(palette: Palette) {
  return vars({
    "--color-primary": channel(palette.primary),
    "--color-secondary": channel(palette.secondary),
    "--color-accent": channel(palette.accent),
    "--color-neutral": channel(palette.neutral),
    "--color-neutral-100": channel(palette.neutral100),
    "--color-neutral-200": channel(palette.neutral200),
    "--color-neutral-300": channel(palette.neutral300),
    "--color-neutral-400": channel(palette.neutral400),
    "--color-card": channel(palette.card),
    "--color-sand": channel(palette.sand),
    "--color-ink": channel(palette.ink),
    "--color-muted": channel(palette.muted),
    "--color-border": channel(palette.border),
    "--color-harvest-soft": channel(palette.harvestSoft),
    "--color-danger": channel(palette.danger),
    "--color-danger-soft": channel(palette.dangerSoft),
  });
}

/**
 * Live palette. Inline styles read the active theme on each render.
 * `white` stays #FFFFFF so labels on teal buttons keep contrast.
 */
export const colors: Palette = {
  get primary() {
    return active.primary;
  },
  get secondary() {
    return active.secondary;
  },
  get tertiary() {
    return active.tertiary;
  },
  get neutral() {
    return active.neutral;
  },
  get neutral100() {
    return active.neutral100;
  },
  get neutral200() {
    return active.neutral200;
  },
  get neutral300() {
    return active.neutral300;
  },
  get neutral400() {
    return active.neutral400;
  },
  get card() {
    return active.card;
  },
  get forest700() {
    return active.forest700;
  },
  get forest600() {
    return active.forest600;
  },
  get forest900() {
    return active.forest900;
  },
  get leaf400() {
    return active.leaf400;
  },
  get harvest() {
    return active.harvest;
  },
  get harvestSoft() {
    return active.harvestSoft;
  },
  get sand() {
    return active.sand;
  },
  get ink() {
    return active.ink;
  },
  get muted() {
    return active.muted;
  },
  get accent() {
    return active.accent;
  },
  get white() {
    return active.white;
  },
  get border() {
    return active.border;
  },
  get danger() {
    return active.danger;
  },
  get dangerSoft() {
    return active.dangerSoft;
  },
};

export const tabBar = {
  height: 84,
  iconSize: 22,
  labelSize: 12,
} as const;
