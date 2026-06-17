import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { GitHubWorkflowJobWebhookPayload } from "./map-workflow-job.js";
import { mapWorkflowJobPayload } from "./map-workflow-job.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function loadFixture<T>(name: string): T {
  const raw = readFileSync(join(fixturesDir, name), "utf8");
  return JSON.parse(raw) as T;
}

const context = {
  workspaceId: "ws-11111111-1111-1111-1111-111111111111",
  runId: "run-33333333-3333-3333-3333-333333333333",
};

describe("mapWorkflowJobPayload", () => {
  it("maps a completed workflow_job fixture to job + steps", () => {
    const payload = loadFixture<GitHubWorkflowJobWebhookPayload>(
      "workflow-job-completed.json",
    );

    const result = mapWorkflowJobPayload(payload, context);

    expect(result.job).toEqual({
      workspaceId: context.workspaceId,
      runId: context.runId,
      externalJobId: "2891501297",
      name: "build",
      status: "completed",
      conclusion: "success",
      runnerName: "GitHub Actions 2",
      startedAt: new Date("2022-10-11T14:22:35Z"),
      completedAt: new Date("2022-10-11T14:23:40Z"),
      durationMs: 65_000,
    });

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toEqual({
      number: 1,
      name: "Set up job",
      status: "completed",
      conclusion: "success",
      startedAt: new Date("2022-10-11T14:22:35Z"),
      completedAt: new Date("2022-10-11T14:22:40Z"),
      durationMs: 5_000,
    });
    expect(result.steps[1]?.name).toBe("Run tests");
    expect(result.steps[2]?.number).toBe(3);
  });

  it("maps a queued workflow_job with empty steps", () => {
    const payload = loadFixture<GitHubWorkflowJobWebhookPayload>(
      "workflow-job-queued.json",
    );

    const result = mapWorkflowJobPayload(payload, context);

    expect(result.job.status).toBe("queued");
    expect(result.job.conclusion).toBeNull();
    expect(result.job.completedAt).toBeNull();
    expect(result.job.durationMs).toBeNull();
    expect(result.job.runnerName).toBeNull();
    expect(result.steps).toEqual([]);
  });
});
