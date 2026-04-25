export type NipuxThemeId =
  | "graphite"
  | "paper-terminal"
  | "arctic-lab"
  | "amber-ops"
  | "glass-console"
  | "blueprint"
  | "studio-dark"
  | "synth-minimal";

export interface NipuxTheme {
  id: NipuxThemeId;
  label: string;
  body: string;
  preview: {
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
  };
}

export const DEFAULT_THEME_ID: NipuxThemeId = "graphite";

export const NIPUX_THEMES: NipuxTheme[] = [
  {
    id: "graphite",
    label: "Graphite",
    body: "Matte black, thin borders, restrained green status.",
    preview: {
      background: "#101010",
      surface: "#171717",
      foreground: "#f1eee7",
      muted: "#a9a49a",
      border: "rgba(255,255,255,0.14)",
      accent: "#8abd6e",
    },
  },
  {
    id: "paper-terminal",
    label: "Paper Terminal",
    body: "Warm paper, black ink, compact terminal rhythm.",
    preview: {
      background: "#eee7d8",
      surface: "#f7f1e6",
      foreground: "#15130f",
      muted: "#6f675b",
      border: "rgba(21,19,15,0.2)",
      accent: "#111111",
    },
  },
  {
    id: "arctic-lab",
    label: "Arctic Lab",
    body: "Bright lab surfaces with ice-blue instrumentation.",
    preview: {
      background: "#edf4f6",
      surface: "#f8fbfc",
      foreground: "#101820",
      muted: "#64727a",
      border: "rgba(16,24,32,0.16)",
      accent: "#4d9ec6",
    },
  },
  {
    id: "amber-ops",
    label: "Amber Ops",
    body: "Dark operations console with amber signal lines.",
    preview: {
      background: "#11100d",
      surface: "#191612",
      foreground: "#f4eadb",
      muted: "#a8987e",
      border: "rgba(244,234,219,0.15)",
      accent: "#d49742",
    },
  },
  {
    id: "glass-console",
    label: "Glass Console",
    body: "Smoky black, translucent panels, white linework.",
    preview: {
      background: "#080a0c",
      surface: "#15191dcc",
      foreground: "#f5f7f8",
      muted: "#94a1a9",
      border: "rgba(245,247,248,0.18)",
      accent: "#c9d7df",
    },
  },
  {
    id: "blueprint",
    label: "Blueprint",
    body: "Technical navy surface with cyan diagram energy.",
    preview: {
      background: "#07121d",
      surface: "#0d1c2c",
      foreground: "#e9f5ff",
      muted: "#8aa1b6",
      border: "rgba(96,190,225,0.22)",
      accent: "#60bee1",
    },
  },
  {
    id: "studio-dark",
    label: "Studio Dark",
    body: "Sober dark gray, compact rows, quiet green active state.",
    preview: {
      background: "#2b2b29",
      surface: "#333331",
      foreground: "#ebe4d2",
      muted: "#9a9487",
      border: "rgba(235,228,210,0.14)",
      accent: "#76b66d",
    },
  },
  {
    id: "synth-minimal",
    label: "Synth Minimal",
    body: "Sparse black and white with a precise cyan-magenta edge.",
    preview: {
      background: "#050505",
      surface: "#111111",
      foreground: "#f7f7f7",
      muted: "#9a9a9a",
      border: "rgba(247,247,247,0.16)",
      accent: "#42d9e8",
    },
  },
];

export function normalizeThemeId(value: string | null | undefined): NipuxThemeId {
  return NIPUX_THEMES.some((theme) => theme.id === value) ? (value as NipuxThemeId) : DEFAULT_THEME_ID;
}

export function themeById(value: string | null | undefined): NipuxTheme {
  const normalized = normalizeThemeId(value);
  return NIPUX_THEMES.find((theme) => theme.id === normalized) ?? NIPUX_THEMES[0];
}

export function applyTheme(value: string | null | undefined) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = normalizeThemeId(value);
}
