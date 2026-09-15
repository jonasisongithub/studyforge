import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the Vite server (5173) proxies /api to the Express server (8787).
// In prod `npm run build` emits dist/ which Express serves directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
