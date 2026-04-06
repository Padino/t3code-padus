import { type AppLanguage } from "@t3tools/contracts/settings";

export type Theme = "light" | "dark" | "system";
export type ThemePresetId =
  | "classic"
  | "light"
  | "super-black"
  | "orange"
  | "vscode"
  | "fuchsia"
  | "sage"
  | "og"
  | "gamer";

export const DEFAULT_THEME: Theme = "system";
export const DEFAULT_THEME_PRESET: ThemePresetId = "classic";

export interface ThemePresetDefinition {
  readonly accent: string;
  readonly background: string;
  readonly card: string;
  readonly description: string;
  readonly id: ThemePresetId;
  readonly label: string;
  readonly previewForeground: string;
}

const THEME_PRESET_IDS: readonly ThemePresetId[] = [
  "classic",
  "light",
  "super-black",
  "orange",
  "vscode",
  "fuchsia",
  "sage",
  "og",
  "gamer",
] as const;

const THEME_PRESET_COPY: Record<
  ThemePresetId,
  {
    readonly description: Record<AppLanguage, string>;
    readonly label: Record<AppLanguage, string>;
    readonly preview: {
      readonly accent: string;
      readonly background: string;
      readonly card: string;
      readonly foreground: string;
    };
  }
> = {
  classic: {
    label: {
      en: "Classic",
      it: "Classic",
    },
    description: {
      en: "Current neutral palette with the existing blue accent.",
      it: "Palette neutra attuale con l’accento blu esistente.",
    },
    preview: {
      background: "#0f1217",
      card: "#181c23",
      accent: "#6c7cff",
      foreground: "#f8fafc",
    },
  },
  light: {
    label: {
      en: "Light",
      it: "Chiaro",
    },
    description: {
      en: "Bright paper surfaces, soft shadows, and clean ink contrast.",
      it: "Superfici chiare da carta, ombre morbide e contrasto pulito.",
    },
    preview: {
      background: "#f4ede3",
      card: "#fffaf2",
      accent: "#3b82f6",
      foreground: "#1f2937",
    },
  },
  "super-black": {
    label: {
      en: "Super Black",
      it: "Super Black",
    },
    description: {
      en: "Near-black chrome with crisp graphite surfaces and icy highlights.",
      it: "Quasi nero assoluto con superfici grafite e highlight freddi.",
    },
    preview: {
      background: "#020202",
      card: "#080808",
      accent: "#f5f5f5",
      foreground: "#f8fafc",
    },
  },
  orange: {
    label: {
      en: "Orange",
      it: "Arancione",
    },
    description: {
      en: "Burnt orange highlights over warm industrial surfaces.",
      it: "Accenti arancio bruciato su superfici calde e industriali.",
    },
    preview: {
      background: "#1a120d",
      card: "#241711",
      accent: "#ff8a3d",
      foreground: "#f8fafc",
    },
  },
  vscode: {
    label: {
      en: "VS Code",
      it: "VS Code",
    },
    description: {
      en: "Inspired by Visual Studio Code with editor-like blues and slates.",
      it: "Ispirato a Visual Studio Code con blu e slate da editor.",
    },
    preview: {
      background: "#1f1f1f",
      card: "#252526",
      accent: "#007acc",
      foreground: "#f8fafc",
    },
  },
  fuchsia: {
    label: {
      en: "Fuchsia",
      it: "Fucsia",
    },
    description: {
      en: "Hot pink neon accents with plum-black contrast.",
      it: "Accenti hot pink neon con contrasto prugna-nero.",
    },
    preview: {
      background: "#190613",
      card: "#260b1d",
      accent: "#ff2dbb",
      foreground: "#f8fafc",
    },
  },
  sage: {
    label: {
      en: "Sage",
      it: "Salvia",
    },
    description: {
      en: "Muted green surfaces with soft botanical contrast.",
      it: "Superfici verde salvia con contrasti morbidi e botanici.",
    },
    preview: {
      background: "#eaf0e8",
      card: "#f5f8f3",
      accent: "#6a8f74",
      foreground: "#1f2937",
    },
  },
  og: {
    label: {
      en: "OG",
      it: "OG",
    },
    description: {
      en: "Platinum beige chrome inspired by Macintosh System 9 windowing.",
      it: "Cromie platinum beige ispirate alle finestre del Macintosh System 9.",
    },
    preview: {
      background: "#d8d4c8",
      card: "#f0ede5",
      accent: "#1e5aa7",
      foreground: "#1f2937",
    },
  },
  gamer: {
    label: {
      en: "Gamer",
      it: "Gamer",
    },
    description: {
      en: "Dark neon arena with hex grids and deep green electric accents.",
      it: "Arena neon scura con griglia esagonale e accenti elettrici verde intenso.",
    },
    preview: {
      background: "#07110c",
      card: "#0d1b14",
      accent: "#39ff8f",
      foreground: "#f8fafc",
    },
  },
};

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return THEME_PRESET_IDS.includes(value as ThemePresetId);
}

export function getThemePresetDefinitions(language: AppLanguage): ThemePresetDefinition[] {
  return THEME_PRESET_IDS.map((id) => {
    const preset = THEME_PRESET_COPY[id];

    return {
      id,
      label: preset.label[language],
      description: preset.description[language],
      accent: preset.preview.accent,
      background: preset.preview.background,
      card: preset.preview.card,
      previewForeground: preset.preview.foreground,
    };
  });
}
