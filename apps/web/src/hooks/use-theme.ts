"use client";

import { useCallback, useEffect, useState } from "react";

/** Persisted theme preference key — shared with themeInitScript in root layout. */
export const THEME_STORAGE_KEY = "pipewatch-theme";

export type Theme = "dark" | "light";

/** Inline script for root layout — applies persisted theme before first paint. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();`;

export function applyTheme(theme: Theme): void {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    return;
  }

  document.documentElement.removeAttribute("data-theme");
}

export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    /* private mode / SSR */
  }

  return null;
}

export function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

export function clearStoredTheme(): void {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export type UseThemeResult = {
  theme: Theme;
  isLight: boolean;
  setTheme: (theme: Theme, options?: { persist?: boolean }) => void;
  toggleTheme: (options?: { persist?: boolean }) => void;
};

/**
 * Theme toggle hook — dark is the default; light mode uses `[data-theme="light"]`.
 * Persistence to localStorage is optional (default: on).
 */
export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = readStoredTheme();
    const initial = stored ?? "dark";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback(
    (next: Theme, options?: { persist?: boolean }) => {
      const persist = options?.persist ?? true;
      applyTheme(next);
      setThemeState(next);

      if (persist) {
        writeStoredTheme(next);
      } else {
        clearStoredTheme();
      }
    },
    [],
  );

  const toggleTheme = useCallback(
    (options?: { persist?: boolean }) => {
      setTheme(theme === "dark" ? "light" : "dark", options);
    },
    [setTheme, theme],
  );

  return {
    theme,
    isLight: theme === "light",
    setTheme,
    toggleTheme,
  };
}
