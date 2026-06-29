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
import type {
  GitHubWorkflowJob,
  GitHubWorkflowJobWebhookPayload,
  GitHubWorkflowRunWebhookPayload,
} from "@pipewatch/utils";
import { encrypt } from "@pipewatch/utils";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { processPipelineJob, ParentRunNotFoundError } from "./process-pipeline-job.js";
import { processPipelineRun } from "./process-pipeline-run.js";
import { findPipelineRunByExternalId } from "../services/pipeline-upsert.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixturesDir = join(
  repoRoot,
  "packages/utils/src/github/fixtures",
);

const encryptionKey = "d".repeat(32);

const workerEnv = parseWorkerEnv({
  NODE_ENV: "development",
  PIPEWATCH_EDITION: "cloud",
  ENCRYPTION_KEY: encryptionKey,
  GITHUB_APP_ID: "123456",
  GITHUB_APP_PRIVATE_KEY: "unused-for-tests",
  RETENTION_DAYS: "30",
});

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

type SeedContext = {
  workspaceId: string;
  repoId: string;
  integrationId?: string;
  fullName?: string;
};

async function seedRepository(
  database: Db,
  options?: { withGitHubToken?: boolean },
): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");
  const fullName = `org-${suffix}/hello-world`;

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "Pipeline Workspace",
      slug: `pipeline-${suffix}`,
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
      externalInstallationId: `install-${suffix}`,
      accountLogin: `org-${suffix}`,
      accountType: "organization",
      accessToken: options?.withGitHubToken
        ? encrypt("ghs_test_token", encryptionKey)
        : "encrypted-token",
      tokenExpiresAt: options?.withGitHubToken
        ? new Date(Date.now() + 60 * 60 * 1000)
        : null,
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
      fullName: options?.withGitHubToken ? fullName : `org-${suffix}/hello-world`,
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
    integrationId: integration.id,
    fullName: repository.fullName,
  };
}

function loadFixtureJob(name: string): GitHubWorkflowJobWebhookPayload {
  const raw = readFileSync(join(fixturesDir, name), "utf8");
  return JSON.parse(raw) as GitHubWorkflowJobWebhookPayload;
}

function createMockJobsFetch(fullName: string, jobs: GitHubWorkflowJob[]) {
  const fetchImpl = vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (!url.includes(`/repos/${fullName}/actions/runs/`) || !url.includes("/jobs")) {
      return new Response("not found", { status: 404 });
    }

    expect(url).toContain("filter=latest");

    return new Response(
      JSON.stringify({
        total_count: jobs.length,
        jobs,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  return fetchImpl;
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

describe("process-pipeline-run integration", () => {
  it("upserts a completed workflow_run fixture into pipeline_runs", async () => {
    const seed = await seedRepository(database);
    const payload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const publishSse = vi.fn(async () => undefined);

    const first = await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: payload.action,
        payload,
      },
      { db: database, publishSse },
    );

    const [run] = await database
      .select()
      .from(pipelineRuns)
      .where(
        and(
          eq(pipelineRuns.repoId, seed.repoId),
          eq(pipelineRuns.externalRunId, "2891501295"),
        ),
      );

    expect(run).toBeDefined();
    expect(run?.status).toBe("completed");
    expect(run?.conclusion).toBe("success");
    expect(run?.durationMs).toBe(75_000);
    expect(run?.pipelineName).toBe("CI");
    expect(first.runId).toBe(run?.id);

    expect(publishSse).toHaveBeenCalledOnce();
    expect(publishSse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "run:completed",
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
      }),
    );

    payload.workflow_run.conclusion = "failure";
    const second = await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: "completed",
        payload,
      },
      { db: database, publishSse },
    );

    expect(second.runId).toBe(first.runId);

    const [updated] = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, first.runId));

    expect(updated?.conclusion).toBe("failure");
    expect(
      await database.select().from(pipelineRuns).where(eq(pipelineRuns.repoId, seed.repoId)),
    ).toHaveLength(1);
  });

  it("stores null duration for in-progress workflow_run events", async () => {
    const seed = await seedRepository(database);
    const payload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-in-progress.json",
    );

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: payload.action,
        payload,
      },
      { db: database },
    );

    const [run] = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.externalRunId, "2891501296"));

    expect(run?.status).toBe("in_progress");
    expect(run?.conclusion).toBeNull();
    expect(run?.completedAt).toBeNull();
    expect(run?.durationMs).toBeNull();
  });

  it("purges stale jobs when run_attempt increases on full workflow re-run", async () => {
    const seed = await seedRepository(database);
    const runPayload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const buildJobPayload = loadFixture<GitHubWorkflowJobWebhookPayload>(
      "workflow-job-completed.json",
    );
    const testJobPayload = structuredClone(buildJobPayload);
    testJobPayload.workflow_job.id = 2891501298;
    testJobPayload.workflow_job.name = "test";
    testJobPayload.workflow_job.html_url =
      "https://github.com/octocat/Hello-World/actions/runs/2891501295/jobs/2891501298";

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
      },
      { db: database },
    );

    const run = await findPipelineRunByExternalId(
      database,
      seed.repoId,
      "2891501295",
    );
    if (!run) {
      throw new Error("Expected parent run");
    }

    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: buildJobPayload.action,
        payload: buildJobPayload,
      },
      { db: database },
    );
    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: testJobPayload.action,
        payload: testJobPayload,
      },
      { db: database },
    );

    expect(
      await database.select().from(pipelineJobs).where(eq(pipelineJobs.runId, run.id)),
    ).toHaveLength(2);

    const rerunPayload = structuredClone(runPayload);
    rerunPayload.workflow_run.run_attempt = 2;
    rerunPayload.workflow_run.status = "in_progress";
    rerunPayload.workflow_run.conclusion = null;
    rerunPayload.workflow_run.updated_at = "2022-10-11T14:24:00Z";

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: "in_progress",
        payload: rerunPayload,
      },
      { db: database },
    );

    const rerunBuildPayload = structuredClone(buildJobPayload);
    rerunBuildPayload.workflow_job.id = 2891501400;
    rerunBuildPayload.workflow_job.html_url =
      "https://github.com/octocat/Hello-World/actions/runs/2891501295/jobs/2891501400";

    const rerunTestPayload = structuredClone(testJobPayload);
    rerunTestPayload.workflow_job.id = 2891501401;
    rerunTestPayload.workflow_job.html_url =
      "https://github.com/octocat/Hello-World/actions/runs/2891501295/jobs/2891501401";

    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: rerunBuildPayload.action,
        payload: rerunBuildPayload,
      },
      { db: database },
    );
    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: rerunTestPayload.action,
        payload: rerunTestPayload,
      },
      { db: database },
    );

    const [updatedRun] = await database
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, run.id));

    expect(updatedRun?.runAttempt).toBe(2);

    const jobs = await database
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.runId, run.id));

    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.externalJobId).sort()).toEqual([
      "2891501400",
      "2891501401",
    ]);
    expect(jobs.map((job) => job.externalJobId)).not.toContain("2891501297");
    expect(jobs.map((job) => job.externalJobId)).not.toContain("2891501298");
  });

  it("updates the same job row when single-job re-run reuses external_job_id", async () => {
    const seed = await seedRepository(database);
    const runPayload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const jobPayload = loadFixture<GitHubWorkflowJobWebhookPayload>(
      "workflow-job-completed.json",
    );

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
      },
      { db: database },
    );

    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: jobPayload.action,
        payload: jobPayload,
      },
      { db: database },
    );

    const rerunPayload = structuredClone(runPayload);
    rerunPayload.workflow_run.run_attempt = 2;
    rerunPayload.workflow_run.status = "in_progress";
    rerunPayload.workflow_run.conclusion = null;

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: "in_progress",
        payload: rerunPayload,
      },
      { db: database },
    );

    jobPayload.workflow_job.name = "build (re-run)";
    jobPayload.workflow_job.conclusion = "failure";
    jobPayload.workflow_job.completed_at = "2022-10-11T14:25:00Z";

    const secondJob = await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: jobPayload.action,
        payload: jobPayload,
      },
      { db: database },
    );

    expect(secondJob.jobId).toBeTruthy();

    const [job] = await database
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.externalJobId, "2891501297"));

    expect(job?.id).toBe(secondJob.jobId);
    expect(job?.name).toBe("build (re-run)");
    expect(job?.conclusion).toBe("failure");
    expect(
      await database.select().from(pipelineJobs).where(eq(pipelineJobs.externalJobId, "2891501297")),
    ).toHaveLength(1);
  });

  it("reconciles missed workflow_job webhooks from GitHub jobs API on run completed", async () => {
    const seed = await seedRepository(database, { withGitHubToken: true });
    if (!seed.fullName) {
      throw new Error("Expected repository full name");
    }

    const runPayload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const jobFixture = loadFixtureJob("workflow-job-completed.json");
    const restJob: GitHubWorkflowJob = jobFixture.workflow_job;
    const fetchImpl = createMockJobsFetch(seed.fullName, [restJob]);
    const publishSse = vi.fn(async () => undefined);

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
        deliveryId: "delivery-reconcile-191",
      },
      { db: database, env: workerEnv, fetchImpl, publishSse },
    );

    const parentRun = await findPipelineRunByExternalId(
      database,
      seed.repoId,
      String(runPayload.workflow_run.id),
    );
    if (!parentRun) {
      throw new Error("Expected parent run");
    }

    const [job] = await database
      .select()
      .from(pipelineJobs)
      .where(
        and(
          eq(pipelineJobs.runId, parentRun.id),
          eq(pipelineJobs.externalJobId, "2891501297"),
        ),
      );

    expect(job).toBeDefined();
    expect(job?.status).toBe("completed");
    expect(job?.conclusion).toBe("success");
    expect(job?.startedAt.toISOString()).toBe("2022-10-11T14:22:35.000Z");
    expect(job?.completedAt?.toISOString()).toBe("2022-10-11T14:23:40.000Z");
    expect(job?.durationMs).toBe(65_000);
    expect(job?.completedAt?.toISOString()).not.toBe(
      new Date(runPayload.workflow_run.updated_at).toISOString(),
    );

    const steps = await database
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.jobId, job?.id ?? ""))
      .orderBy(pipelineSteps.number);

    expect(steps).toHaveLength(3);

    expect(publishSse).toHaveBeenCalledTimes(2);
    expect(publishSse).toHaveBeenCalledWith(
      expect.objectContaining({ type: "run:completed" }),
    );
    expect(publishSse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "job:updated",
        data: expect.objectContaining({
          id: job?.id,
          status: "completed",
          conclusion: "success",
        }),
      }),
    );

    publishSse.mockClear();

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
      },
      { db: database, env: workerEnv, fetchImpl, publishSse },
    );

    expect(
      publishSse.mock.calls.filter((call) => call[0]?.type === "job:updated"),
    ).toHaveLength(0);
    expect(
      await database.select().from(pipelineJobs).where(eq(pipelineJobs.runId, parentRun.id)),
    ).toHaveLength(1);
  });

  it("fixes queued jobs left behind when workflow_job completed webhook was missed", async () => {
    const seed = await seedRepository(database, { withGitHubToken: true });
    if (!seed.fullName) {
      throw new Error("Expected repository full name");
    }

    const runPayload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const queuedPayload = loadFixtureJob("workflow-job-queued.json");
    queuedPayload.workflow_job.run_id = runPayload.workflow_run.id;
    queuedPayload.workflow_job.id = 2891501297;

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
      },
      { db: database },
    );

    const parentRun = await findPipelineRunByExternalId(
      database,
      seed.repoId,
      String(runPayload.workflow_run.id),
    );
    if (!parentRun) {
      throw new Error("Expected parent run");
    }

    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: queuedPayload.action,
        payload: queuedPayload,
      },
      { db: database },
    );

    const [staleJob] = await database
      .select()
      .from(pipelineJobs)
      .where(
        and(
          eq(pipelineJobs.runId, parentRun.id),
          eq(pipelineJobs.externalJobId, "2891501297"),
        ),
      );

    expect(staleJob?.status).toBe("queued");
    expect(staleJob?.completedAt).toBeNull();

    const completedFixture = loadFixtureJob("workflow-job-completed.json");
    const fetchImpl = createMockJobsFetch(seed.fullName, [
      completedFixture.workflow_job,
    ]);

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: "completed",
        payload: runPayload,
      },
      { db: database, env: workerEnv, fetchImpl },
    );

    const [reconciledJob] = await database
      .select()
      .from(pipelineJobs)
      .where(
        and(
          eq(pipelineJobs.runId, parentRun.id),
          eq(pipelineJobs.externalJobId, "2891501297"),
        ),
      );

    expect(reconciledJob?.status).toBe("completed");
    expect(reconciledJob?.conclusion).toBe("success");
    expect(reconciledJob?.completedAt?.toISOString()).toBe(
      "2022-10-11T14:23:40.000Z",
    );
    expect(
      await database
        .select()
        .from(pipelineJobs)
        .where(
          and(
            eq(pipelineJobs.runId, parentRun.id),
            eq(pipelineJobs.status, "queued"),
          ),
        ),
    ).toHaveLength(0);
  });
});

describe("process-pipeline-job integration", () => {
  it("upserts workflow_job + steps after the parent run exists", async () => {
    const seed = await seedRepository(database);
    const runPayload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const jobPayload = loadFixture<GitHubWorkflowJobWebhookPayload>(
      "workflow-job-completed.json",
    );
    const publishSse = vi.fn(async () => undefined);

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
      },
      { db: database },
    );

    const parentRun = await findPipelineRunByExternalId(
      database,
      seed.repoId,
      String(runPayload.workflow_run.id),
    );
    if (!parentRun) {
      throw new Error("Expected parent run");
    }

    const result = await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: jobPayload.action,
        payload: jobPayload,
      },
      { db: database, publishSse },
    );

    const [job] = await database
      .select()
      .from(pipelineJobs)
      .where(
        and(
          eq(pipelineJobs.runId, parentRun.id),
          eq(pipelineJobs.externalJobId, "2891501297"),
        ),
      );

    expect(job).toBeDefined();
    expect(job?.id).toBe(result.jobId);
    expect(job?.status).toBe("completed");
    expect(job?.durationMs).toBe(65_000);
    expect(job?.runnerName).toBe("GitHub Actions 2");
    expect(job?.sourceUrl).toBe(
      "https://github.com/octocat/Hello-World/actions/runs/2891501295/jobs/2891501297",
    );

    const steps = await database
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.jobId, result.jobId))
      .orderBy(pipelineSteps.number);

    expect(steps).toHaveLength(3);
    expect(steps[0]?.name).toBe("Set up job");
    expect(steps[0]?.durationMs).toBe(5_000);
    expect(steps[1]?.name).toBe("Run tests");
    expect(steps[2]?.number).toBe(3);

    expect(publishSse).toHaveBeenCalledOnce();
    expect(publishSse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "job:updated",
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
      }),
    );

    jobPayload.workflow_job.name = "build (updated)";
    await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: jobPayload.action,
        payload: jobPayload,
      },
      { db: database },
    );

    const jobs = await database
      .select()
      .from(pipelineJobs)
      .where(
        and(
          eq(pipelineJobs.runId, parentRun.id),
          eq(pipelineJobs.externalJobId, "2891501297"),
        ),
      );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe("build (updated)");
  });

  it("self-heals when workflow_job arrives before workflow_run", async () => {
    const seed = await seedRepository(database);
    const runPayload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    const jobPayload = loadFixture<GitHubWorkflowJobWebhookPayload>(
      "workflow-job-completed.json",
    );
    const publishSse = vi.fn(async () => undefined);

    await expect(
      processPipelineJob(
        {
          workspaceId: seed.workspaceId,
          repoId: seed.repoId,
          action: jobPayload.action,
          payload: jobPayload,
        },
        { db: database, publishSse },
      ),
    ).rejects.toBeInstanceOf(ParentRunNotFoundError);

    expect(publishSse).not.toHaveBeenCalled();

    await processPipelineRun(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: runPayload.action,
        payload: runPayload,
      },
      { db: database },
    );

    const result = await processPipelineJob(
      {
        workspaceId: seed.workspaceId,
        repoId: seed.repoId,
        action: jobPayload.action,
        payload: jobPayload,
      },
      { db: database, publishSse },
    );

    const [job] = await database
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.id, result.jobId));

    expect(job).toBeDefined();
    expect(job?.id).toBe(result.jobId);
    expect(publishSse).toHaveBeenCalledOnce();
  });
});
