import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/db-admin", {
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      exclude: ["src/**/*.integration.test.ts"],
    },
  }),
);
