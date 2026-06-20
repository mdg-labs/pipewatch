import { defineConfig } from "vitest/config";

/**
 * Monorepo Vitest workspace — references per-package configs for unit vs integration
 * suites (PRD §11). Package scripts and Turbo still run each project directly; this
 * root file is the single map of all test projects for IDE discovery and
 * `vitest --project <name>` from the repo root.
 */
export default defineConfig({
  test: {
    projects: [
      "scripts/vitest.config.ts",
      "apps/api/vitest.config.ts",
      "apps/web/vitest.config.ts",
      "packages/config/vitest.config.ts",
      "packages/db/vitest.config.ts",
      "packages/ui/vitest.config.ts",
      "packages/utils/vitest.config.ts",
      "apps/api/vitest.integration.config.ts",
      "apps/worker/vitest.integration.config.ts",
    ],
  },
});
