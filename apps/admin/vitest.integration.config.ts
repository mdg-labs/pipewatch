import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("integration", "@pipewatch/admin", {
    test: {
      environment: "node",
      include: ["src/**/*.integration.test.ts"],
      fileParallelism: false,
      testTimeout: 120_000,
    },
  }),
);
