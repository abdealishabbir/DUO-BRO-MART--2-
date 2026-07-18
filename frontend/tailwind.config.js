/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Phase 1 placeholder palette — real brand tokens land with the
        // Phase 3 storefront design pass, not decided here.
        brand: {
          DEFAULT: "#0f766e",
          dark: "#0b5a54",
        },
      },
    },
  },
  plugins: [],
};
