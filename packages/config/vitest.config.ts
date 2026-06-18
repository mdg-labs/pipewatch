import { defineConfig } from "vitest/config";

import { withReportPortal } from "./vitest-reportportal.js";

export default defineConfig(
  withReportPortal("unit", "@pipewatch/config", {
    test: {
      environment: "node",
    },
  }),
);
