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

import { backfillRepo } from "./backfill-repo.js";

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

async function seedRepository(database: Db): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");
  const fullName = `org-${suffix}/hello-world`;
  const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Backfill Workspace",
      slug: `backfill-${suffix}`,
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
  let jobData = data;

  return {
    data: jobData,
    updateData: vi.fn(async (next: T) => {
      jobData = next;
      return undefined;
    }),
    log: vi.fn(async () => undefined),
    get currentData() {
      return jobData;
    },
  };
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

describe("backfill-repo integration", () => {
  it("ingests paginated workflow runs and updates last_synced_at", async () => {
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

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(101);
    expect(result.historyTruncated).toBe(false);
    const runCalls = filterRunsListCalls(calls);
    expect(runCalls).toHaveLength(2);
    expect(runCalls[0]).toContain("page=1");
    expect(runCalls[0]).toContain("created=");
    expect(runCalls[1]).toContain("page=2");

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

  it("resumes from a stored runsPage cursor", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");
    const runTwo = loadFixtureRun("workflow-run-in-progress.json");
    runTwo.id = 2891501299;

    const { fetchImpl, calls } = createMockWorkflowRunsFetch(seed.fullName, [
      [runOne],
      [runTwo],
    ]);

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
      runsPage: 2,
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(1);
    expect(result.historyTruncated).toBe(false);
    const runCalls = filterRunsListCalls(calls);
    expect(runCalls).toHaveLength(1);
    expect(runCalls[0]).toContain("page=2");

    const [run] = await database
      .select()
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.repoId, seed.repoId),
          eq(pipelineRuns.externalRunId, "2891501299"),
        ),
      );

    expect(run).toBeDefined();
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

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(0);
    expect(result.historyTruncated).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("ingests more than 1000 runs across chunked time windows", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");

    const runsPerWindow = 501;
    let windowIndex = 0;

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes(`/actions/runs/`) && url.includes("/jobs")) {
        return emptyJobsResponse();
      }

      if (!url.includes(`/repos/${seed.fullName}/actions/runs`)) {
        return new Response("not found", { status: 404 });
      }

      const pageMatch = /[?&]page=(\d+)/.exec(url);
      const page = pageMatch ? Number(pageMatch[1]) : 1;
      const baseId = 3_000_000 + windowIndex * 10_000;

      const runs =
        page === 1
          ? Array.from({ length: 100 }, (_, index) => ({
              ...runOne,
              id: baseId + index,
            }))
          : page === 2
            ? Array.from({ length: 100 }, (_, index) => ({
                ...runOne,
                id: baseId + 100 + index,
              }))
            : page === 3
              ? Array.from({ length: 100 }, (_, index) => ({
                  ...runOne,
                  id: baseId + 200 + index,
                }))
              : page === 4
                ? Array.from({ length: 100 }, (_, index) => ({
                    ...runOne,
                    id: baseId + 300 + index,
                  }))
                : page === 5
                  ? Array.from({ length: 100 }, (_, index) => ({
                      ...runOne,
                      id: baseId + 400 + index,
                    }))
                  : page === 6
                    ? Array.from({ length: 1 }, (_, index) => ({
                        ...runOne,
                        id: baseId + 500 + index,
                      }))
                    : [];

      if (page === 1) {
        windowIndex += 1;
      }

      return new Response(
        JSON.stringify({
          total_count: runsPerWindow,
          workflow_runs: runs,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
      pendingWindows: [
        {
          start: "2026-06-17T00:00:00.000Z",
          end: "2026-06-17T12:00:00.000Z",
        },
        {
          start: "2026-06-17T12:00:00.001Z",
          end: "2026-06-18T00:00:00.000Z",
        },
      ],
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(1002);
    expect(result.historyTruncated).toBe(false);
    expect(
      filterRunsListCalls(fetchImpl.mock.calls.map(([request]) =>
        typeof request === "string" ? request : request.toString(),
      )),
    ).toHaveLength(12);

    const runs = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.repoId, seed.repoId));

    expect(runs).toHaveLength(1002);
  }, 30_000);

  it("subdivides a window when GitHub total_count reaches the search cap", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes(`/actions/runs/`) && url.includes("/jobs")) {
        return emptyJobsResponse();
      }

      if (!url.includes(`/repos/${seed.fullName}/actions/runs`)) {
        return new Response("not found", { status: 404 });
      }

      const createdMatch = /[?&]created=([^&]+)/.exec(url);
      const created = decodeURIComponent(createdMatch?.[1] ?? "");
      const rangeMatch = /^(.+)\.\.(.+)$/.exec(created);
      const durationMs = rangeMatch
        ? Date.parse(rangeMatch[2]) - Date.parse(rangeMatch[1])
        : Number.POSITIVE_INFINITY;

      if (durationMs > 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            total_count: 1500,
            workflow_runs: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      const pageMatch = /[?&]page=(\d+)/.exec(url);
      const page = pageMatch ? Number(pageMatch[1]) : 1;
      const runs =
        page === 1
          ? Array.from({ length: 100 }, (_, index) => ({
              ...runOne,
              id: 4_000_000 + index,
            }))
          : page === 2
            ? Array.from({ length: 50 }, (_, index) => ({
                ...runOne,
                id: 4_000_100 + index,
              }))
            : [];

      return new Response(
        JSON.stringify({
          total_count: 150,
          workflow_runs: runs,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
      pendingWindows: [
        {
          start: "2026-06-01T00:00:00.000Z",
          end: "2026-06-01T02:00:00.000Z",
        },
      ],
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(300);
    expect(result.historyTruncated).toBe(false);
    expect(fetchImpl.mock.calls.some(([request]) => {
      const url = typeof request === "string" ? request : request.toString();
      return url.includes("created=") && decodeURIComponent(url).includes("..");
    })).toBe(true);
    expect(job.log).not.toHaveBeenCalled();
  });

  it("signals truncation when the minimum window still exceeds the search cap", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes(`/actions/runs/`) && url.includes("/jobs")) {
        return emptyJobsResponse();
      }

      if (!url.includes(`/repos/${seed.fullName}/actions/runs`)) {
        return new Response("not found", { status: 404 });
      }

      const pageMatch = /[?&]page=(\d+)/.exec(url);
      const page = pageMatch ? Number(pageMatch[1]) : 1;
      const runs =
        page <= 10
          ? Array.from({ length: 100 }, (_, index) => ({
              ...runOne,
              id: 5_000_000 + page * 100 + index,
            }))
          : [];

      return new Response(
        JSON.stringify({
          total_count: 1200,
          workflow_runs: runs,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const job = createJob({
      repoId: seed.repoId,
      workspaceId: seed.workspaceId,
      integrationId: seed.integrationId,
      pendingWindows: [
        {
          start: "2026-06-01T00:00:00.000Z",
          end: "2026-06-01T00:30:00.000Z",
        },
      ],
    });

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(1000);
    expect(result.historyTruncated).toBe(true);
    expect(job.log).toHaveBeenCalled();
  }, 30_000);

  it("ingests workflow jobs and steps for each run via REST", async () => {
    const seed = await seedRepository(database);
    const runOne = loadFixtureRun("workflow-run-completed.json");
    const jobFixture = loadFixtureJob("workflow-job-completed.json");
    const jobCalls: string[] = [];

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
        jobCalls.push(url);
        expect(url).toContain("filter=latest");
        expect(url).toContain("per_page=100");

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

    const result = await backfillRepo(job, {
      db: database,
      env: workerEnv,
      fetchImpl,
    });

    expect(result.runsIngested).toBe(1);
    expect(jobCalls).toHaveLength(1);

    const [run] = await database
      .select()
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.repoId, seed.repoId),
          eq(pipelineRuns.externalRunId, String(runOne.id)),
        ),
      );

    expect(run).toBeDefined();

    const jobs = await database
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.runId, run!.id));

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.externalJobId).toBe(String(jobFixture.workflow_job.id));
    expect(jobs[0]?.name).toBe("build");

    const steps = await database
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.jobId, jobs[0]!.id));

    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.name)).toEqual([
      "Set up job",
      "Run tests",
      "Post job cleanup",
    ]);
  });
});
