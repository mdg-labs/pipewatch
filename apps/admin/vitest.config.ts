import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/admin", {
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      testTimeout: 15_000,
    },
  }),
);
