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
    },
  },
  plugins: [],
};
