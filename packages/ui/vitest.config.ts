import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/ui", {
    esbuild: {
      jsx: "automatic",
    },
    test: {
      environment: "node",
    },
  }),
);
