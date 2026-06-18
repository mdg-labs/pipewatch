import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  withReportPortal("unit", "@pipewatch/web", {
    esbuild: {
      jsx: "automatic",
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
    test: {
      environment: "happy-dom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  }),
);
