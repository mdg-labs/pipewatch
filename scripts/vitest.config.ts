import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  test: {
    name: "scripts",
    root: repoRoot,
    include: ["scripts/i18n-*.test.ts"],
    environment: "node",
  },
});
