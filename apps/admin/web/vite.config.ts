import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  build: {
    outDir: path.join(webRoot, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
      },
    },
  },
});
