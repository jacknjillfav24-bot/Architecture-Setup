import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the built site works from any folder (e.g. GitHub Pages).
  base: "./",
  worker: { format: "es" },
  build: {
    target: "es2022",
    // The in-browser AI engine is one large file that only loads when it is turned on.
    chunkSizeWarningLimit: 8000,
  },
});
