import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  DEFAULT_THEME_PRESET,
  isTheme,
  isThemePresetId,
  type Theme,
  type ThemePresetId,
} from "../theme";

type ThemeSnapshot = {
  themePreset: ThemePresetId;
  theme: Theme;
  systemDark: boolean;
};

const THEME_STORAGE_KEY = "t3code:theme";
const THEME_PRESET_STORAGE_KEY = "t3code:theme-preset";
const LEGACY_THEME_PALETTE_STORAGE_KEY = "t3code:theme-palette";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: Theme | null = null;

function emitChange() {
  for (const listener of listeners) listener();
}

function getSystemDark(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getStored(): Theme {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(raw) ? raw : DEFAULT_THEME;
}

function getStoredPreset(): ThemePresetId {
  const raw = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
  if (isThemePresetId(raw)) {
    return raw;
  }

  const legacyPalette = localStorage.getItem(LEGACY_THEME_PALETTE_STORAGE_KEY);
  if (legacyPalette === "sage") {
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, "sage");
    return "sage";
  }
  if (legacyPalette === "default") {
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, DEFAULT_THEME_PRESET);
  }

  return DEFAULT_THEME_PRESET;
}

function applyTheme(theme: Theme, themePreset: ThemePresetId, suppressTransitions = false) {
  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }
  const isDark = theme === "dark" || (theme === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.themePreset = themePreset;
  syncDesktopTheme(theme);
  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

function syncDesktopTheme(theme: Theme) {
  const bridge = window.desktopBridge;
  if (!bridge || lastDesktopTheme === theme) {
    return;
  }

  lastDesktopTheme = theme;
  void bridge.setTheme(theme).catch(() => {
    if (lastDesktopTheme === theme) {
      lastDesktopTheme = null;
    }
  });
}

// Apply immediately on module load to prevent flash
applyTheme(getStored(), getStoredPreset());

function getSnapshot(): ThemeSnapshot {
  const theme = getStored();
  const themePreset = getStoredPreset();
  const systemDark = theme === "system" ? getSystemDark() : false;

  if (
    lastSnapshot &&
    lastSnapshot.theme === theme &&
    lastSnapshot.themePreset === themePreset &&
    lastSnapshot.systemDark === systemDark
  ) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, themePreset, systemDark };
  return lastSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);

  // Listen for system preference changes
  const mq = window.matchMedia(MEDIA_QUERY);
  const handleChange = () => {
    if (getStored() === "system") {
      applyTheme("system", getStoredPreset(), true);
    }
    emitChange();
  };
  mq.addEventListener("change", handleChange);

  // Listen for storage changes from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY || e.key === THEME_PRESET_STORAGE_KEY) {
      applyTheme(getStored(), getStoredPreset(), true);
      emitChange();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    mq.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const theme = snapshot.theme;
  const themePreset = snapshot.themePreset;

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (snapshot.systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next, getStoredPreset(), true);
    emitChange();
  }, []);

  const setThemePreset = useCallback((next: ThemePresetId) => {
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, next);
    applyTheme(getStored(), next, true);
    emitChange();
  }, []);

  // Keep DOM in sync on mount/change
  useEffect(() => {
    applyTheme(theme, themePreset);
  }, [theme, themePreset]);

  return { theme, setTheme, themePreset, setThemePreset, resolvedTheme } as const;
}
