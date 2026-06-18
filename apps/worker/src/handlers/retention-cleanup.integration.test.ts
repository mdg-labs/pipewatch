import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseWorkerEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineRuns,
  repositories,
  workspaces,
} from "@pipewatch/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const editionMock = vi.hoisted(() => ({
  flags: {
    BILLING_ENABLED: true,
    PLAN_LIMITS_ENABLED: true,
    WAITLIST_ENABLED: true,
    NEWSLETTER_ENABLED: true,
    MULTI_WORKSPACE_ENABLED: true,
    BOOTSTRAP_ENABLED: false,
    UMAMI_ENABLED: true,
    STRIPE_ENABLED: true,
    API_KEYS_ENABLED: true,
    SSO_ENABLED: false,
    RETENTION_CEILING: true,
    IS_CE: false,
    IS_CLOUD: true,
  },
}));

vi.mock("@pipewatch/config/edition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pipewatch/config/edition")>();
  return {
    ...actual,
    flags: editionMock.flags,
  };
});

import {
  deleteExpiredRunsForRepo,
  retentionCleanup,
} from "./retention-cleanup.js";
import {
  closeMaintenanceQueue,
  RETENTION_CLEANUP_BATCH_SIZE,
  RETENTION_CLEANUP_CRON_UTC,
  RETENTION_CLEANUP_JOB_NAME,
  registerRetentionCleanupSchedule,
} from "../queues/maintenance.js";
import { getQueue, QUEUE_NAMES } from "../queues/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

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
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const probe = getQueue(QUEUE_NAMES.MAINTENANCE, url);
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
  integrationId: string;
  repoId: string;
};

async function seedRepository(
  database: Db,
  options: {
    plan?: "free" | "pro" | "business";
    defaultRetentionDays?: number;
    retentionDays?: number | null;
  } = {},
): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Retention Workspace",
      slug: `retention-${suffix}`,
      plan: options.plan ?? "pro",
      defaultRetentionDays: options.defaultRetentionDays ?? 30,
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
      externalInstallationId: `install-${suffix}`,
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
      externalRepoId: `repo-${suffix}`,
      fullName: `org-${suffix}/hello-world`,
      private: false,
      enabled: true,
      retentionDays: options.retentionDays ?? null,
    })
    .returning();

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return {
    workspaceId: workspace.id,
    integrationId: integration.id,
    repoId: repository.id,
  };
}

async function seedRun(
  database: Db,
  context: SeedContext,
  externalRunId: string,
  startedAt: Date,
): Promise<void> {
  await database.insert(pipelineRuns).values({
    workspaceId: context.workspaceId,
    repoId: context.repoId,
    externalRunId,
    pipelineName: "CI",
    pipelineDefinitionRef: "ci.yml",
    status: "completed",
    conclusion: "success",
    branch: "main",
    commitSha: "abc123",
    triggerType: "push",
    sourceUrl: `https://github.com/example/actions/runs/${externalRunId}`,
    startedAt,
    completedAt: startedAt,
  });
}

function createJob() {
  return { data: {} };
}

let postgresContainerId = "";
let redisContainerId = "";
let database: Db;
let redisUrl = "";
const now = new Date("2026-06-17T12:00:00.000Z");

beforeAll(async () => {
  const pgPort = 57000 + Math.floor(Math.random() * 5000);
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
  await waitForPostgres(databaseUrl);

  execSync("pnpm --filter @pipewatch/db db:migrate", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
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
  await waitForRedis(redisUrl);
}, 120_000);

afterAll(async () => {
  await closeMaintenanceQueue();
  await closeDb(database);

  if (postgresContainerId) {
    spawnSync("docker", ["stop", postgresContainerId], { stdio: "pipe" });
  }

  if (redisContainerId) {
    spawnSync("docker", ["stop", redisContainerId], { stdio: "pipe" });
  }
});

describe("retention-cleanup integration", () => {
  beforeEach(async () => {
    await database.delete(pipelineRuns);
    await database.delete(repositories);
    await database.delete(integrations);
    await database.delete(workspaces);
  });
  it("deletes runs older than effective retention and keeps recent runs", async () => {
    editionMock.flags.RETENTION_CEILING = true;

    const context = await seedRepository(database, {
      plan: "pro",
      defaultRetentionDays: 30,
      retentionDays: null,
    });

    await seedRun(database, context, "old-run", new Date("2026-05-01T00:00:00.000Z"));
    await seedRun(database, context, "recent-run", new Date("2026-06-10T00:00:00.000Z"));

    const env = parseWorkerEnv({
      NODE_ENV: "development",
      PIPEWATCH_EDITION: "cloud",
      RETENTION_DAYS: "30",
    });

    const result = await retentionCleanup(createJob(), { db: database, env, now });

    expect(result).toEqual({ reposProcessed: 1, runsDeleted: 1 });

    const remaining = await database
      .select({ externalRunId: pipelineRuns.externalRunId })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, context.repoId));

    expect(remaining.map((row) => row.externalRunId)).toEqual(["recent-run"]);
  });

  it("uses RETENTION_DAYS env default on CE without plan ceiling", async () => {
    editionMock.flags.RETENTION_CEILING = false;

    const context = await seedRepository(database, {
      plan: "pro",
      defaultRetentionDays: 30,
      retentionDays: null,
    });

    await seedRun(database, context, "ce-old-run", new Date("2026-02-01T00:00:00.000Z"));
    await seedRun(database, context, "ce-kept-run", new Date("2026-04-01T00:00:00.000Z"));

    const env = parseWorkerEnv({
      NODE_ENV: "development",
      PIPEWATCH_EDITION: "ce",
      RETENTION_DAYS: "90",
    });

    const result = await retentionCleanup(createJob(), { db: database, env, now });

    expect(result).toEqual({ reposProcessed: 1, runsDeleted: 1 });

    const remaining = await database
      .select({ externalRunId: pipelineRuns.externalRunId })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, context.repoId));

    expect(remaining.map((row) => row.externalRunId)).toEqual(["ce-kept-run"]);
  });

  it("enforces cloud free-plan retention ceiling during cleanup", async () => {
    editionMock.flags.RETENTION_CEILING = true;

    const context = await seedRepository(database, {
      plan: "free",
      defaultRetentionDays: 30,
      retentionDays: 365,
    });

    await seedRun(database, context, "free-old-run", new Date("2026-05-01T00:00:00.000Z"));
    await seedRun(database, context, "free-recent-run", new Date("2026-06-10T00:00:00.000Z"));

    const env = parseWorkerEnv({
      NODE_ENV: "development",
      PIPEWATCH_EDITION: "cloud",
      RETENTION_DAYS: "30",
    });

    const result = await retentionCleanup(createJob(), { db: database, env, now });

    expect(result).toEqual({ reposProcessed: 1, runsDeleted: 1 });

    const remaining = await database
      .select({ externalRunId: pipelineRuns.externalRunId })
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.repoId, context.repoId),
          eq(pipelineRuns.externalRunId, "free-recent-run"),
        ),
      );

    expect(remaining).toHaveLength(1);
  });

  it("deletes expired runs in fixed-size batches", async () => {
    editionMock.flags.RETENTION_CEILING = true;

    const context = await seedRepository(database, {
      plan: "pro",
      defaultRetentionDays: 7,
      retentionDays: 7,
    });

    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oldStartedAt = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);

    for (let index = 0; index < 3; index += 1) {
      await seedRun(database, context, `batch-run-${String(index)}`, oldStartedAt);
    }

    const deleted = await deleteExpiredRunsForRepo(database, context.repoId, 7, now, 2);

    expect(deleted).toBe(3);

    const remainingCount = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, context.repoId));

    expect(remainingCount[0]?.count).toBe(0);
  });

  it("registers daily 03:00 UTC repeatable retention-cleanup on maintenance queue", async () => {
    expect(RETENTION_CLEANUP_BATCH_SIZE).toBe(1000);

    await registerRetentionCleanupSchedule(redisUrl);

    const queue = getQueue(QUEUE_NAMES.MAINTENANCE, redisUrl);
    const repeatables = await queue.getRepeatableJobs();
    const match = repeatables.find((job) => job.name === RETENTION_CLEANUP_JOB_NAME);

    expect(match).toBeDefined();
    expect(match?.pattern).toBe(RETENTION_CLEANUP_CRON_UTC);
    expect(match?.tz).toBe("UTC");
  });
});
