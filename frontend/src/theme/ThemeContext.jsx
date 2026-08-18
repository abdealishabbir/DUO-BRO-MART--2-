import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "dbm_theme_v1";

// Swatch hexes here are just for rendering the picker UI (ThemeSwitcher) —
// the actual applied colors live in index.css as CSS variables per
// [data-palette] block. Keep these in sync with the --color-brand value
// for each palette there if either ever changes.
export const PALETTES = [
  { id: "terracotta", label: "Terracotta", swatch: "#9A4A1D" },
  { id: "ocean", label: "Ocean", swatch: "#1D6E9A" },
  { id: "forest", label: "Forest", swatch: "#2F7D4F" },
  { id: "berry", label: "Berry", swatch: "#9A2D5E" },
];
const PALETTE_IDS = PALETTES.map((p) => p.id);

const DEFAULT_THEME = { palette: "terracotta", mode: "light" };

function loadInitialTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return {
      palette: PALETTE_IDS.includes(parsed.palette) ? parsed.palette : DEFAULT_THEME.palette,
      mode: parsed.mode === "dark" ? "dark" : "light",
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  // A personal, per-device display preference — same localStorage
  // convention as CartContext (dbm_*_v1). Never sent to the backend or
  // attached to an account, so it's never shared across devices and
  // never visible to anyone else: a customer, vendor, or admin who
  // switches palette or mode only changes what they themselves see.
  // Everyone who hasn't touched it keeps seeing the standard terracotta/
  // light theme, in every portal.
  const [theme, setTheme] = useState(loadInitialTheme);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    // index.html runs the same two lines before mount (to avoid a flash
    // of the default theme on load) — keep both in sync if this changes.
    document.documentElement.setAttribute("data-palette", theme.palette);
    document.documentElement.setAttribute("data-mode", theme.mode);
  }, [theme]);

  const setPalette = (palette) => {
    if (PALETTE_IDS.includes(palette)) setTheme((prev) => ({ ...prev, palette }));
  };
  const setMode = (mode) => setTheme((prev) => ({ ...prev, mode: mode === "dark" ? "dark" : "light" }));
  const toggleMode = () => setTheme((prev) => ({ ...prev, mode: prev.mode === "dark" ? "light" : "dark" }));
  const resetTheme = () => setTheme(DEFAULT_THEME);

  const value = { ...theme, palettes: PALETTES, setPalette, setMode, toggleMode, resetTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
