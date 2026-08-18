import { useEffect, useRef, useState } from "react";
import { Palette, Sun, Moon, Check, RotateCcw } from "lucide-react";
import { useTheme } from "./ThemeContext.jsx";

/**
 * Compact popover for picking an accent palette and light/dark mode.
 * Same component is dropped into CustomerLayout, VendorLayout, and
 * AdminLayout headers — the choice only ever affects the browser it's
 * made in (see ThemeContext), so it's safe to expose identically in
 * all three portals without needing separate customer/vendor/admin
 * variants.
 */
export default function ThemeSwitcher({ variant = "light" }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { palette, mode, palettes, setPalette, setMode, resetTheme } = useTheme();

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        // variant="dark" is for placement on fixed-dark chrome (the admin
        // sidebar's bg-ink) where the default gray-400/600 trigger
        // wouldn't have enough contrast — matches that sidebar's own
        // text-white/60 hover:text-white convention instead.
        className={`flex items-center ${
          variant === "dark" ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-600"
        }`}
        aria-label="Theme settings"
        aria-expanded={open}
      >
        <Palette className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-gray-100 bg-surface p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Appearance</p>
            <button
              type="button"
              onClick={resetTheme}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-brand"
              title="Reset to default theme"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMode("light")}
              aria-pressed={mode === "light"}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium ${
                mode === "light" ? "border-brand bg-cream text-brand" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button
              type="button"
              onClick={() => setMode("dark")}
              aria-pressed={mode === "dark"}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium ${
                mode === "dark" ? "border-brand bg-cream text-brand" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
          </div>

          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Color palette</p>
          <div className="grid grid-cols-2 gap-1.5">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                aria-pressed={palette === p.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  palette === p.id ? "border-brand text-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: p.swatch }}
                >
                  {palette === p.id && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </span>
                {p.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-snug text-gray-400">
            Only visible to you — other shoppers, vendors, and admins keep seeing the standard theme.
          </p>
        </div>
      )}
    </div>
  );
}
