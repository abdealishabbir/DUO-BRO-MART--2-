/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Matched to the ShopNest reference screenshots (see UI_BUILD_TRACKER.md)
        brand: {
          DEFAULT: "#C2703C",
          dark: "#A35A2C",
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
