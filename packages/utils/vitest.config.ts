import { defineConfig } from "vitest/config";

import { withReportPortal } from "@pipewatch/config/vitest-reportportal";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/utils", {
    test: {
      environment: "node",
    },
  }),
);
