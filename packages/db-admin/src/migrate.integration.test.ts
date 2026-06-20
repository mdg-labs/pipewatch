import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

let containerId = "";
let databaseUrl = "";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(url: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = postgres(url, { max: 1 });
      await probe`select 1`;
      await probe.end({ timeout: 5 });
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Postgres container did not become ready in time");
}

beforeAll(async () => {
  const port = 55000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--label",
      "pipewatch-test=db-admin",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      `${String(port)}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" },
  );

  if (run.status !== 0) {
    throw new Error(run.stderr || "Failed to start Postgres container");
  }

  containerId = run.stdout.trim();
  databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${String(port)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;

  await waitForPostgres(databaseUrl);

  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });

  execSync("pnpm --filter @pipewatch/db-admin db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });
}, 120_000);

afterAll(async () => {
  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }
});

describe("db-admin migrations", () => {
  it("creates admin schema with all five tables", async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const tables = await client<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'admin'
        order by table_name
      `;

      expect(tables.map((row) => row.table_name)).toEqual([
        "admin_invites",
        "admin_sessions",
        "admin_users",
        "audit_events",
        "webhook_deliveries",
      ]);

      const partialIndexes = await client<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = 'admin'
          and indexdef like '%WHERE%'
      `;

      expect(
        partialIndexes.some((row) =>
          row.indexname.includes("webhook_deliveries_failures"),
        ),
      ).toBe(true);
    } finally {
      await client.end({ timeout: 5 });
    }
  });
});
