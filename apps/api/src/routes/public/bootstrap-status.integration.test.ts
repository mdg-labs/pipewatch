import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { users } from "@pipewatch/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { registerBootstrapStatusRoute } from "./bootstrap-status.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const editionMock = vi.hoisted(() => ({
  flags: {
    BOOTSTRAP_ENABLED: true,
    IS_CE: true,
    IS_CLOUD: false,
  },
}));

vi.mock("@pipewatch/config/edition", () => editionMock);

function createTestApp(database: Db) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);
  registerBootstrapStatusRoute(app, { db: database });
  return app;
}

let containerId = "";
let database: Db;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(databaseUrl: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = createDb(databaseUrl);
      await probe.execute(sql`select 1`);
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

  database = createDb(databaseUrl);
}, 120_000);

afterAll(async () => {
  if (containerId) {
    spawnSync("docker", ["stop", containerId], { stdio: "pipe" });
  }

  await closeDb();
});

describe("bootstrap status integration", () => {
  it("returns bootstrapRequired true when CE edition has zero users", async () => {
    editionMock.flags.BOOTSTRAP_ENABLED = true;
    editionMock.flags.IS_CE = true;
    editionMock.flags.IS_CLOUD = false;

    const app = createTestApp(database);
    const response = await app.request("http://localhost/api/v1/public/bootstrap-status");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bootstrapRequired: true,
      userCount: 0,
    });
  });

  it("returns bootstrapRequired false when CE edition has users", async () => {
    editionMock.flags.BOOTSTRAP_ENABLED = true;

    await database.insert(users).values({
      githubId: 900001n,
      githubLogin: "bootstrap-test-user",
      email: "bootstrap@example.com",
      name: "Bootstrap Test",
    });

    const app = createTestApp(database);
    const response = await app.request("http://localhost/api/v1/public/bootstrap-status");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bootstrapRequired: false,
      userCount: 1,
    });
  });

  it("always returns bootstrapRequired false on cloud edition", async () => {
    editionMock.flags.BOOTSTRAP_ENABLED = false;
    editionMock.flags.IS_CE = false;
    editionMock.flags.IS_CLOUD = true;

    const app = createTestApp(database);
    const response = await app.request("http://localhost/api/v1/public/bootstrap-status");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      bootstrapRequired: boolean;
      userCount: number;
    };
    expect(body.bootstrapRequired).toBe(false);
    expect(body.userCount).toBeGreaterThanOrEqual(1);
  });
});
