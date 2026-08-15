import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  // Vitest reads its config from this same `test` key — no separate
  // vitest.config.js needed, and it automatically inherits the same
  // @vitejs/plugin-react setup the dev/build server uses (JSX transform,
  // Fast Refresh disabled in test mode automatically).
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: false, // Tailwind's CSS import isn't relevant to jsdom assertions and only slows startup
    globals: false, // deliberate — explicit `import { describe, it, expect } from "vitest"` per file, not magic globals
  },
});
