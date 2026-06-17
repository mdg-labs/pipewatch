#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const packages = ["@pipewatch/api", "@pipewatch/worker"];

for (const pkg of packages) {
  const result = spawnSync("pnpm", ["--filter", pkg, "test:integration"], {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.exit(0);
