import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import { integrations, repositories, workspaces } from "@pipewatch/db/schema";
import {
  closeAllQueues,
  getQueue,
  QUEUE_NAMES,
} from "@pipewatch/worker/queues";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { signGitHubWebhookPayload } from "../../lib/github-webhook-signature.js";
import { errorHandler } from "../../middleware/error-handler.js";
import {
  PROCESS_PIPELINE_RUN_JOB_NAME,
  registerGitHubWebhookRoute,
} from "./github.js";
import type { ApiEnv } from "../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const fixturesDir = join(repoRoot, "packages/utils/src/github/fixtures");

const webhookSecret = "d".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  ENCRYPTION_KEY: "c".repeat(32),
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
  GITHUB_WEBHOOK_SECRET: webhookSecret,
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "",
  REDIS_URL: "",
};

function loadFixture<T>(name: string): T {
  const raw = readFileSync(join(fixturesDir, name), "utf8");
  return JSON.parse(raw) as T;
}

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

async function waitForRedis(redisUrl: string, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = getQueue(QUEUE_NAMES.MAINTENANCE, redisUrl);
      await probe.getJobCounts();
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error("Redis container did not become ready in time");
}

type SeedContext = {
  workspaceId: string;
  repoId: string;
  installationId: string;
  externalRepoId: string;
};

async function seedRepository(database: Db): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");
  const installationId = String(100_000 + Math.floor(Math.random() * 900_000));
  const externalRepoId = String(200_000 + Math.floor(Math.random() * 900_000));

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Webhook Workspace",
      slug: `webhook-${suffix}`,
      plan: "pro",
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  const [integration] = await database
    .insert(integrations)
    .values({
      workspaceId: workspace.id,
      provider: "github",
      externalInstallationId: installationId,
      accountLogin: `org-${suffix}`,
      accountType: "organization",
      accessToken: "encrypted-token",
    })
    .returning();

  if (!integration) {
    throw new Error("Failed to seed integration");
  }

  const [repository] = await database
    .insert(repositories)
    .values({
      workspaceId: workspace.id,
      integrationId: integration.id,
      externalRepoId,
      fullName: `org-${suffix}/hello-world`,
      private: false,
      enabled: true,
    })
    .returning();

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return {
    workspaceId: workspace.id,
    repoId: repository.id,
    installationId,
    externalRepoId,
  };
}

function buildWebhookPayload(
  fixture: Record<string, unknown>,
  context: Pick<SeedContext, "installationId" | "externalRepoId">,
): string {
  return JSON.stringify({
    ...fixture,
    installation: { id: Number(context.installationId) },
    repository: { id: Number(context.externalRepoId) },
  });
}

function createTestApp(database: Db, redisUrl: string) {
  const app = new OpenAPIHono<ApiEnv>();
  app.onError(errorHandler);

  const env = parseApiEnv(
    {
      ...baseEnv,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: redisUrl,
    },
    "cloud",
  );

  registerGitHubWebhookRoute(app, { env, db: database, rateLimit: { disabled: true } });
  return app;
}

let postgresContainerId = "";
let redisContainerId = "";
let database: Db;
let redisUrl = "";

beforeAll(async () => {
  const postgresPort = 55000 + Math.floor(Math.random() * 5000);
  const postgresPassword = randomBytes(12).toString("hex");
  const postgresRun = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "-e",
      `POSTGRES_PASSWORD=${postgresPassword}`,
      "-p",
      `${String(postgresPort)}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" },
  );

  if (postgresRun.status !== 0) {
    throw new Error(postgresRun.stderr || "Failed to start Postgres container");
  }

  postgresContainerId = postgresRun.stdout.trim();
  const databaseUrl = `postgresql://postgres:${postgresPassword}@127.0.0.1:${String(postgresPort)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;

  await waitForPostgres(databaseUrl);

  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });

  database = createDb(databaseUrl);

  const redisPort = 56000 + Math.floor(Math.random() * 5000);
  const redisRun = spawnSync(
    "docker",
    ["run", "-d", "--rm", "-p", `${String(redisPort)}:6379`, "redis:7-alpine"],
    { encoding: "utf8" },
  );

  if (redisRun.status !== 0) {
    throw new Error(redisRun.stderr || "Failed to start Redis container");
  }

  redisContainerId = redisRun.stdout.trim();
  redisUrl = `redis://127.0.0.1:${String(redisPort)}`;
  process.env.REDIS_URL = redisUrl;

  await waitForRedis(redisUrl);
}, 120_000);

afterAll(async () => {
  await closeAllQueues();

  if (redisContainerId) {
    spawnSync("docker", ["stop", redisContainerId], { stdio: "pipe" });
  }

  if (postgresContainerId) {
    spawnSync("docker", ["stop", postgresContainerId], { stdio: "pipe" });
  }

  await closeDb();
});

describe("GitHub webhook receiver integration", () => {
  it("returns 401 when the webhook signature is invalid", async () => {
    const app = createTestApp(database, redisUrl);
    const fixture = loadFixture<Record<string, unknown>>("workflow-run-completed.json");
    const body = JSON.stringify(fixture);

    const response = await app.request("http://localhost/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "workflow_run",
        "X-Hub-Signature-256": "sha256=deadbeef",
      },
      body,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature",
      },
    });
  });

  it("returns 401 when the signature header is missing", async () => {
    const app = createTestApp(database, redisUrl);
    const fixture = loadFixture<Record<string, unknown>>("workflow-run-completed.json");
    const body = JSON.stringify(fixture);

    const response = await app.request("http://localhost/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "workflow_run",
      },
      body,
    });

    expect(response.status).toBe(401);
  });

  it("accepts a valid signature, enqueues workflow_run, and returns 200", async () => {
    const context = await seedRepository(database);
    const fixture = loadFixture<Record<string, unknown>>("workflow-run-completed.json");
    const body = buildWebhookPayload(fixture, context);
    const signature = signGitHubWebhookPayload(body, webhookSecret);

    const enqueueWebhookEvent = vi.fn(async () => undefined);
    const env = parseApiEnv(
      {
        ...baseEnv,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: redisUrl,
      },
      "cloud",
    );

    const app = new OpenAPIHono<ApiEnv>();
    app.onError(errorHandler);
    registerGitHubWebhookRoute(app, {
      env,
      db: database,
      enqueueWebhookEvent,
      rateLimit: { disabled: true },
    });

    const response = await app.request("http://localhost/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "workflow_run",
        "X-Hub-Signature-256": signature,
        "X-GitHub-Delivery": "72d3162e-cc78-11e3-81ab-4c9367dc0958",
      },
      body,
    });

    expect(response.status).toBe(200);
    expect(enqueueWebhookEvent).toHaveBeenCalledOnce();
    expect(enqueueWebhookEvent).toHaveBeenCalledWith(
      PROCESS_PIPELINE_RUN_JOB_NAME,
      expect.objectContaining({
        workspaceId: context.workspaceId,
        repoId: context.repoId,
        action: "completed",
        deliveryId: "72d3162e-cc78-11e3-81ab-4c9367dc0958",
      }),
    );
  });

  it("accepts a valid signature for workflow_job and returns 200 without enqueue when repo is disabled", async () => {
    const context = await seedRepository(database);
    await database
      .update(repositories)
      .set({ enabled: false })
      .where(eq(repositories.id, context.repoId));

    const fixture = loadFixture<Record<string, unknown>>("workflow-job-completed.json");
    const body = buildWebhookPayload(fixture, context);
    const signature = signGitHubWebhookPayload(body, webhookSecret);

    const enqueueWebhookEvent = vi.fn(async () => undefined);
    const env = parseApiEnv(
      {
        ...baseEnv,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: redisUrl,
      },
      "cloud",
    );

    const app = new OpenAPIHono<ApiEnv>();
    app.onError(errorHandler);
    registerGitHubWebhookRoute(app, {
      env,
      db: database,
      enqueueWebhookEvent,
      rateLimit: { disabled: true },
    });

    const response = await app.request("http://localhost/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "workflow_job",
        "X-Hub-Signature-256": signature,
      },
      body,
    });

    expect(response.status).toBe(200);
    expect(enqueueWebhookEvent).not.toHaveBeenCalled();
  });
});
