#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const defaultPackages = ["@pipewatch/api", "@pipewatch/worker", "@pipewatch/admin"];
const requested = process.argv.slice(2).filter(Boolean);
const packages = requested.length > 0 ? requested : defaultPackages;

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
