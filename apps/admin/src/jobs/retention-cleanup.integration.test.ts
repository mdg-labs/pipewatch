import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeDb, createDb, type Db } from "@pipewatch/db";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import {
  runRetentionCleanupJob,
  WEBHOOK_DELIVERY_RETENTION_DAYS,
} from "./retention-cleanup.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

let containerId = "";
let database: Db;

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

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function seedDelivery(
  db: Db,
  githubDeliveryId: string,
  deliveredAt: Date,
): Promise<void> {
  await db.insert(webhookDeliveries).values({
    githubDeliveryId,
    githubGuid: `guid-${githubDeliveryId}`,
    event: "push",
    statusCode: 200,
    status: "OK",
    deliveredAt,
  });
}

beforeAll(async () => {
  const port = 56000 + Math.floor(Math.random() * 5000);
  const password = randomBytes(12).toString("hex");
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--label",
      "pipewatch-test=admin-retention-cleanup",
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
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${String(port)}/postgres`;
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

  database = createDb(databaseUrl);
}, 120_000);

afterAll(async () => {
  await closeDb();
  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }
});

describe("retention cleanup job integration", () => {
  it("deletes only webhook deliveries older than 45 days", async () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    const expiredAt = daysAgo(now, WEBHOOK_DELIVERY_RETENTION_DAYS + 1);
    const retainedAt = daysAgo(now, WEBHOOK_DELIVERY_RETENTION_DAYS - 1);

    await seedDelivery(database, "expired-1", expiredAt);
    await seedDelivery(database, "expired-2", expiredAt);
    await seedDelivery(database, "retained-1", retainedAt);

    const result = await runRetentionCleanupJob({ db: database, now });
    expect(result.deleted).toBe(2);

    const remaining = await database.select().from(webhookDeliveries);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.githubDeliveryId).toBe("retained-1");
  });

  it("is safe on an empty table", async () => {
    const rows = await database.select().from(webhookDeliveries);
    for (const row of rows) {
      await database
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.id, row.id));
    }

    const result = await runRetentionCleanupJob({
      db: database,
      now: new Date("2026-06-20T12:00:00.000Z"),
    });
    expect(result.deleted).toBe(0);
  });
});
