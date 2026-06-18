import { execSync, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAPIHono } from "@hono/zod-openapi";
import { parseApiEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  repositories,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { getSseChannel } from "@pipewatch/types";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { createSseToken } from "../../../services/sse-token.js";
import { registerStreamRoute } from "./stream.js";
import type { ApiEnv } from "../../../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

const testSecret = "a".repeat(32);

const baseEnv: Record<string, string> = {
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  JWT_SECRET: testSecret,
  JWT_REFRESH_SECRET: "b".repeat(32),
  DATABASE_URL: "",
  REDIS_URL: "",
};

let postgresContainerId = "";
let redisContainerId = "";
let redisUrl = "";
let database: Db;
let redis: Redis;

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

async function waitForRedis(url: string, attempts = 30): Promise<void> {
  const probe = new Redis(url, { maxRetriesPerRequest: null });

  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const pong = await probe.ping();
        if (pong === "PONG") {
          return;
        }
      } catch {
        await sleep(500);
      }
    }

    throw new Error("Redis container did not become ready in time");
  } finally {
    await probe.quit();
  }
}

type SeedContext = {
  userId: string;
  workspaceId: string;
  repoId: string;
};

async function seedStreamContext(): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");
  const githubId = BigInt(`0x${randomBytes(7).toString("hex")}`);

  const [user] = await database
    .insert(users)
    .values({
      githubId,
      githubLogin: `stream-user-${suffix}`,
      email: `stream-${suffix}@example.com`,
      name: "Stream User",
    })
    .returning();

  if (!user) {
    throw new Error("Failed to seed user");
  }

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Stream Workspace",
      slug: `stream-${suffix}`,
      plan: "pro",
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to seed workspace");
  }

  await database.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "member",
    acceptedAt: new Date(),
  });

  const [integration] = await database
    .insert(integrations)
    .values({
      workspaceId: workspace.id,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: `org-${suffix}`,
      accountType: "Organization",
      accessToken: "encrypted-token",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
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
      externalRepoId: `repo-${suffix}`,
      fullName: `org/stream-${suffix}`,
      private: false,
      enabled: true,
    })
    .returning();

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return {
    userId: user.id,
    workspaceId: workspace.id,
    repoId: repository.id,
  };
}

function createTestApp() {
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

  registerStreamRoute(app, { env, db: database, redis });

  return app;
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (chunk: string) => boolean,
  timeoutMs = 10_000,
): Promise<string> {
  const decoder = new TextDecoder();
  let received = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    received += decoder.decode(value, { stream: true });
    if (predicate(received)) {
      return received;
    }
  }

  return received;
}

beforeAll(async () => {
  const pgPort = 56000 + Math.floor(Math.random() * 5000);
  const redisPort = pgPort + 1;
  const password = randomBytes(12).toString("hex");

  const pgRun = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      `${String(pgPort)}:5432`,
      "postgres:16-alpine",
    ],
    { encoding: "utf8" },
  );

  if (pgRun.status !== 0) {
    throw new Error(pgRun.stderr || "Failed to start Postgres container");
  }

  postgresContainerId = pgRun.stdout.trim();
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${String(pgPort)}/postgres`;
  process.env.DATABASE_URL = databaseUrl;
  baseEnv.DATABASE_URL = databaseUrl;

  await waitForPostgres(databaseUrl);

  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });

  database = createDb(databaseUrl);

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
  baseEnv.REDIS_URL = redisUrl;

  await waitForRedis(redisUrl);
  redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
}, 120_000);

afterAll(async () => {
  if (redis) {
    await redis.quit();
  }

  if (redisContainerId) {
    spawnSync("docker", ["stop", redisContainerId], { stdio: "pipe" });
  }

  if (postgresContainerId) {
    spawnSync("docker", ["stop", postgresContainerId], { stdio: "pipe" });
  }

  await closeDb();
});

describe("GET /api/v1/workspaces/:workspaceId/repos/:repoId/stream integration", () => {
  it("streams a published run event after token validation", async () => {
    const seed = await seedStreamContext();
    const app = createTestApp();

    const { token } = await createSseToken(redis, {
      userId: seed.userId,
      workspaceId: seed.workspaceId,
    });

    const abort = new AbortController();
    const response = await app.request(
      `/api/v1/workspaces/${seed.workspaceId}/repos/${seed.repoId}/stream?token=${encodeURIComponent(token)}`,
      { signal: abort.signal },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Expected readable SSE body");
    }

    const readTask = readUntil(reader, (chunk) => chunk.includes("run:created"));

    await sleep(200);

    await redis.publish(
      getSseChannel(seed.workspaceId, seed.repoId),
      JSON.stringify({
        type: "run:created",
        data: {
          id: randomBytes(16).toString("hex"),
          pipelineName: "CI",
          status: "in_progress",
          conclusion: null,
          branch: "main",
          startedAt: new Date().toISOString(),
          completedAt: null,
          durationMs: null,
        },
      }),
    );

    const received = await readTask;
    abort.abort();

    expect(received).toContain('"type":"run:created"');
    expect(received).toContain('"pipelineName":"CI"');
  });

  it("rejects invalid or reused tokens", async () => {
    const seed = await seedStreamContext();
    const app = createTestApp();

    const missing = await app.request(
      `/api/v1/workspaces/${seed.workspaceId}/repos/${seed.repoId}/stream?token=invalid-token`,
    );
    expect(missing.status).toBe(401);

    const { token } = await createSseToken(redis, {
      userId: seed.userId,
      workspaceId: seed.workspaceId,
    });

    const first = await app.request(
      `/api/v1/workspaces/${seed.workspaceId}/repos/${seed.repoId}/stream?token=${encodeURIComponent(token)}`,
    );
    expect(first.status).toBe(200);
    await first.body?.cancel();

    const second = await app.request(
      `/api/v1/workspaces/${seed.workspaceId}/repos/${seed.repoId}/stream?token=${encodeURIComponent(token)}`,
    );
    expect(second.status).toBe(401);
  });

  it("returns 404 when the repository does not exist in the workspace", async () => {
    const seed = await seedStreamContext();
    const app = createTestApp();
    const missingRepoId = randomUUID();

    const { token } = await createSseToken(redis, {
      userId: seed.userId,
      workspaceId: seed.workspaceId,
    });

    const response = await app.request(
      `/api/v1/workspaces/${seed.workspaceId}/repos/${missingRepoId}/stream?token=${encodeURIComponent(token)}`,
    );

    expect(response.status).toBe(404);
  });
});
