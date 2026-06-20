import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/admin", {
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "web/src/**/*.test.tsx"],
      exclude: ["src/**/*.integration.test.ts"],
      environmentMatchGlobs: [["web/src/**", "happy-dom"]],
      testTimeout: 15_000,
    },
  }),
);
