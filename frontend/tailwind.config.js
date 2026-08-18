/** @type {import('tailwindcss').Config} */

// Reads each color from a CSS custom property (set in index.css and
// switched at runtime by ThemeContext via data-palette/data-mode
// attributes on <html>) while still supporting Tailwind's opacity
// modifiers (bg-brand/10, text-cream/60, etc.) — the standard
// CSS-variable-color pattern from the Tailwind docs.
function withOpacity(variableName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgb(var(${variableName}) / ${opacityValue})`
      : `rgb(var(${variableName}))`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Matched to the ShopNest reference screenshots (see UI_BUILD_TRACKER.md).
        // Values now live in index.css as CSS variables so the palette and
        // light/dark mode can swap at runtime — see the theme system note
        // at the top of index.css for the full explanation.
        brand: {
          DEFAULT: withOpacity("--color-brand"),
          dark: withOpacity("--color-brand-dark"),
          light: withOpacity("--color-brand-light"),
        },
        gold: {
          DEFAULT: withOpacity("--color-gold"),
          dark: withOpacity("--color-gold-dark"),
        },
        cream: withOpacity("--color-cream"),
        // Fixed dark chrome/button color — intentionally NOT theme-reactive,
        // see index.css.
        ink: withOpacity("--color-ink"),
        // Card/page-surface background — replaces the old bare `bg-white`
        // usage across the app so surfaces respond to light/dark mode
        // without touching the literal white/black Tailwind primitives
        // (still used, unchanged, for button text and overlay tints).
        surface: withOpacity("--color-surface"),
        // Primary heading/text color — replaces the old `text-ink` usage
        // so body copy stays readable in dark mode.
        heading: withOpacity("--color-heading"),
        // The full gray scale is redefined here (not just extended) so
        // every existing text-gray-*/bg-gray-*/border-gray-* class in the
        // app — the vast majority of neutral UI color usage — becomes
        // theme-reactive automatically, with zero changes needed in the
        // 60+ files that already use it. Status colors (red/green/amber/
        // blue/purple) and literal white/black are left as Tailwind's
        // stock values in both modes; see index.css for why.
        gray: {
          50: withOpacity("--color-gray-50"),
          100: withOpacity("--color-gray-100"),
          200: withOpacity("--color-gray-200"),
          300: withOpacity("--color-gray-300"),
          400: withOpacity("--color-gray-400"),
          500: withOpacity("--color-gray-500"),
          600: withOpacity("--color-gray-600"),
          700: withOpacity("--color-gray-700"),
          800: withOpacity("--color-gray-800"),
          900: withOpacity("--color-gray-900"),
        },
      },
      fontFamily: {
        // Figtree replaces Tailwind's default system-font stack as the
        // app-wide body/UI face — this alone means every existing element
        // that doesn't explicitly set a font (i.e. almost everything)
        // picks it up automatically, no per-file changes needed. Chosen
        // for legibility at the small sizes this app leans on heavily
        // (dense admin/vendor tables, price tags), not just for looks.
        sans: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
        // Bricolage Grotesque — applied deliberately, via `font-display`,
        // only to headings on customer-facing pages (see the note in
        // frontend-design's guidance on spending boldness in one place).
        // A sans-serif display face on purpose: pairing a warm cream/
        // terracotta palette with a high-contrast SERIF display is one of
        // the most common AI-generated-design defaults, so this pairing
        // deliberately steps away from that specific combination while
        // keeping the same warm mood.
        display: ["Bricolage Grotesque", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
