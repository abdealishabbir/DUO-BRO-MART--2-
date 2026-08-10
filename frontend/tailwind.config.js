/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Matched to the ShopNest reference screenshots (see UI_BUILD_TRACKER.md)
        brand: {
          DEFAULT: "#9A4A1D",
          dark: "#703511",
          light: "#E8C9AC",
        },
        gold: {
          DEFAULT: "#D9A94E",
          dark: "#C4933A",
        },
        cream: "#FDF6EE",
        ink: "#171512",
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
