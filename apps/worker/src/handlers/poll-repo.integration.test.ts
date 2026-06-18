import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseWorkerEnv } from "@pipewatch/config/env";
import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineJobs,
  pipelineRuns,
  pipelineSteps,
  repositories,
  workspaces,
} from "@pipewatch/db/schema";
import type { GitHubWorkflowJobWebhookPayload, GitHubWorkflowRun } from "@pipewatch/utils";
import { encrypt } from "@pipewatch/utils";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { pollRepo } from "./poll-repo.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixturesDir = join(
  repoRoot,
  "packages/utils/src/github/fixtures",
);

const encryptionKey = "c".repeat(32);

const workerEnv = parseWorkerEnv({
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ENCRYPTION_KEY: encryptionKey,
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "unused-for-tests",
  RETENTION_DAYS: "30",
});

function loadFixtureRun(name: string): GitHubWorkflowRun {
  const raw = readFileSync(join(fixturesDir, name), "utf8");
  const payload = JSON.parse(raw) as { workflow_run: GitHubWorkflowRun };
  return payload.workflow_run;
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

type SeedContext = {
  workspaceId: string;
  integrationId: string;
  repoId: string;
  fullName: string;
};

type SeedOptions = {
  lastSyncedAt?: Date | null;
};

async function seedRepository(database: Db, options: SeedOptions = {}): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");
  const fullName = `org-${suffix}/hello-world`;
  const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Poll Workspace",
      slug: `poll-${suffix}`,
      plan: "pro",
      defaultRetentionDays: 30,
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
      accessToken: encrypt("ghs_test_token", encryptionKey),
      tokenExpiresAt,
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
      fullName,
      private: false,
      enabled: true,
      pollingIntervalSeconds: 60,
      ...(options.lastSyncedAt !== undefined
        ? { lastSyncedAt: options.lastSyncedAt }
        : {}),
    })
    .returning();

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return {
    workspaceId: workspace.id,
    integrationId: integration.id,
    repoId: repository.id,
    fullName,
  };
}

function loadFixtureJob(name: string) {
  const raw = readFileSync(join(fixturesDir, name), "utf8");
  return JSON.parse(raw) as GitHubWorkflowJobWebhookPayload;
}

function emptyJobsResponse(): Response {
  return new Response(
    JSON.stringify({ total_count: 0, jobs: [] }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function filterRunsListCalls(calls: string[]): string[] {
  return calls.filter(
    (url) => url.includes("/actions/runs") && !url.includes("/jobs"),
  );
}

function createMockWorkflowRunsFetch(
  fullName: string,
  pages: GitHubWorkflowRun[][],
) {
  const calls: string[] = [];

  const fetchImpl = vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);

    if (url.includes(`/actions/runs/`) && url.includes("/jobs")) {
      return emptyJobsResponse();
    }

    const pageMatch = /[?&]page=(\d+)/.exec(url);
    const page = pageMatch ? Number(pageMatch[1]) : 1;
    const runs = pages[page - 1] ?? [];

    if (!url.includes(`/repos/${fullName}/actions/runs`)) {
      return new Response("not found", { status: 404 });
    }

    return new Response(
      JSON.stringify({
        total_count: pages.flat().length,
        workflow_runs: runs,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  return { fetchImpl, calls };
}

function createJob<T>(data: T) {
  return { data };
}

let containerId = "";
let database: Db;

beforeAll(async () => {
  const port = 57000 + Math.floor(Math.random() * 5000);
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

describe("poll-repo integration", () => {
  it("ingests paginated workflow runs across multiple pages", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");
    const runTwo = loadFixtureRun("workflow-run-in-progress.json");
    runTwo.id = 2891501298;

    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      ...runOne,
      id: 2_891_501_300 + index,
    }));

    const { fetchImpl, calls } = createMockWorkflowRunsFetch(seed.fullName, [
      fullPage,
      [runTwo],
    ]);

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(101);
    const runCalls = filterRunsListCalls(calls);
    expect(runCalls.length).toBeGreaterThanOrEqual(2);
    expect(runCalls[0]).toContain("page=1");

    const runs = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, seed.repoId));

    expect(runs).toHaveLength(101);
    expect(runs.some((run) => run.externalRunId === "2891501298")).toBe(true);

    const [repository] = await database
      .select()
      .from(repositories)
      .where(eq(repositories.id, seed.repoId));

    expect(repository?.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("uses datetime precision for created when last_synced_at is set", async () => {
    const lastSyncedAt = new Date("2026-06-17T15:30:00.000Z");
    const seed = await seedRepository(database, { lastSyncedAt });
    const runOne = loadFixtureRun("workflow-run-completed.json");

    const { fetchImpl, calls } = createMockWorkflowRunsFetch(seed.fullName, [[runOne]]);

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    const runCalls = filterRunsListCalls(calls);
    expect(runCalls.length).toBeGreaterThanOrEqual(1);
    expect(runCalls.some((url) => url.includes(
      encodeURIComponent(`>=${lastSyncedAt.toISOString()}`),
    ))).toBe(true);
  });

  it("advances last_synced_at when GitHub returns zero runs", async () => {
    const lastSyncedAt = new Date("2026-06-10T12:00:00.000Z");
    const seed = await seedRepository(database, { lastSyncedAt });

    const { fetchImpl, calls } = createMockWorkflowRunsFetch(seed.fullName, [[]]);

    const beforePoll = Date.now();

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(0);
    expect(result.runsDeleted).toBe(0);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const [repository] = await database
      .select()
      .from(repositories)
      .where(eq(repositories.id, seed.repoId));

    expect(repository?.lastSyncedAt).toBeInstanceOf(Date);
    expect(repository?.lastSyncedAt?.getTime()).toBeGreaterThanOrEqual(beforePoll);
    expect(repository?.lastSyncedAt?.getTime()).toBeGreaterThan(lastSyncedAt.getTime());

    const runs = await database
      .select()
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.repoId, seed.repoId),
        ),
      );

    expect(runs).toHaveLength(0);
  });

  it("skips disabled repositories", async () => {
    const seed = await seedRepository(database);
    await database
      .update(repositories)
      .set({ enabled: false })
      .where(eq(repositories.id, seed.repoId));

    const fetchImpl = vi.fn(async () => new Response("unexpected", { status: 500 }));

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("ingests workflow jobs and steps during poll via REST", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");
    const jobFixture = loadFixtureJob("workflow-job-completed.json");

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes(`/repos/${seed.fullName}/actions/runs`) && !url.includes("/jobs")) {
        return new Response(
          JSON.stringify({ total_count: 1, workflow_runs: [runOne] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.includes(`/actions/runs/${String(runOne.id)}/jobs`)) {
        return new Response(
          JSON.stringify({
            total_count: 1,
            jobs: [jobFixture.workflow_job],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(1);

    const [run] = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, seed.repoId));

    expect(run).toBeDefined();

    const jobs = await database
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.runId, run!.id));

    expect(jobs).toHaveLength(1);

    const steps = await database
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.jobId, jobs[0]!.id));

    expect(steps).toHaveLength(3);
  });

  it("removes pipeline runs deleted on GitHub during poll reconciliation", async () => {
    const seed = await seedRepository(database);
    const deletedRunId = "9990001";
    const recentStartedAt = new Date();

    await database.insert(pipelineRuns).values({
      workspaceId: seed.workspaceId,
      repoId: seed.repoId,
      externalRunId: deletedRunId,
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123def456",
      triggerType: "push",
      sourceUrl: `https://github.com/${seed.fullName}/actions/runs/${deletedRunId}`,
      startedAt: recentStartedAt,
      completedAt: recentStartedAt,
      runAttempt: 1,
    });

    const { fetchImpl } = createMockWorkflowRunsFetch(seed.fullName, [[]]);

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
    });

    const result = await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(0);
    expect(result.runsDeleted).toBe(1);

    const runs = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, seed.repoId));

    expect(runs).toHaveLength(0);
  });

  it("does not delete runs in other workspaces during reconciliation", async () => {
    const seedA = await seedRepository(database);
    const seedB = await seedRepository(database);
    const recentStartedAt = new Date();
    const runA = loadFixtureRun("workflow-run-completed.json");
    runA.id = 7777001;
    const runBId = "7777002";

    await database.insert(pipelineRuns).values({
      workspaceId: seedB.workspaceId,
      repoId: seedB.repoId,
      externalRunId: runBId,
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123def456",
      triggerType: "push",
      sourceUrl: `https://github.com/${seedB.fullName}/actions/runs/${runBId}`,
      startedAt: recentStartedAt,
      completedAt: recentStartedAt,
      runAttempt: 1,
    });

    const { fetchImpl } = createMockWorkflowRunsFetch(seedA.fullName, [[runA]]);

    const job = createJob({
      repoId: seedA.repoId,
      workspaceId: seedA.workspaceId,
      integrationId: seedA.integrationId,
    });

    const result = await pollRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsDeleted).toBe(0);

    const runsB = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, seedB.repoId));

    expect(runsB).toHaveLength(1);
    expect(runsB[0]?.externalRunId).toBe(runBId);
  });
});
