import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeId = "aether" | "teal" | "violet" | "crimson";

/** Adding a theme: add an id here (with its `swatch` for the picker) and a
 * matching `html[data-theme="..."]` block in index.css — nothing else
 * needs to change, ThemeSwitcher renders this list generically. */
export const THEMES: { id: ThemeId; swatch: string }[] = [
  { id: "aether", swatch: "#f2711c" },
  { id: "teal", swatch: "#14b8a6" },
  { id: "violet", swatch: "#8b5cf6" },
  { id: "crimson", swatch: "#e11d48" },
];

const STORAGE_KEY = "aether-gui:theme";
const DEFAULT_THEME: ThemeId = "aether";

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => readStoredTheme());

  useEffect(() => {
    // "aether" is the :root default with no override block of its own (see
    // index.css) — omitting the attribute entirely for it, rather than
    // setting data-theme="aether", keeps that block from needing to exist.
    if (theme === DEFAULT_THEME) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  function setTheme(next: ThemeId) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — worst case the choice doesn't survive a restart.
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
