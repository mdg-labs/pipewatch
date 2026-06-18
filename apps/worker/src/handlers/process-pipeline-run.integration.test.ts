import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  GitHubWorkflowJobWebhookPayload,
  GitHubWorkflowRunWebhookPayload,
} from "@pipewatch/utils";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { processPipelineJob, ParentRunNotFoundError } from "./process-pipeline-job.js";
import { processPipelineRun } from "./process-pipeline-run.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixturesDir = join(
  repoRoot,
  "packages/utils/src/github/fixtures",
);

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
};

async function seedRepository(database: Db): Promise<SeedContext> {
  const suffix = randomBytes(4).toString("hex");

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
    })
    .returning();

  if (!repository) {
    throw new Error("Failed to seed repository");
  }

  return {
    workspaceId: workspace.id,
    repoId: repository.id,
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
      .where(eq(pipelineJobs.externalJobId, "2891501297"));

    expect(job).toBeDefined();
    expect(job?.id).toBe(result.jobId);
    expect(job?.status).toBe("completed");
    expect(job?.durationMs).toBe(65_000);
    expect(job?.runnerName).toBe("GitHub Actions 2");

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
      .where(eq(pipelineJobs.externalJobId, "2891501297"));

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
