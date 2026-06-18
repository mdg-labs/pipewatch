import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/api", {
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      exclude: ["src/**/*.integration.test.ts"],
      testTimeout: 15_000,
    },
  }),
);
