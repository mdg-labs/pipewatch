import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { GitHubWorkflowRunWebhookPayload } from "./map-workflow-run.js";
import { mapWorkflowRunPayload } from "./map-workflow-run.js";

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
  repoId: "repo-22222222-2222-2222-2222-222222222222",
};

describe("mapWorkflowRunPayload", () => {
  it("maps a completed workflow_run fixture to a pipeline run upsert shape", () => {
    const payload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );

    const result = mapWorkflowRunPayload(payload, context);

    expect(result).toEqual({
      workspaceId: context.workspaceId,
      repoId: context.repoId,
      externalRunId: "2891501295",
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "b5e8e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2",
      commitMessage: "Fix typo in README",
      actorLogin: "octocat",
      triggerType: "push",
      sourceUrl:
        "https://github.com/octocat/Hello-World/actions/runs/2891501295",
      startedAt: new Date("2022-10-11T14:22:30Z"),
      completedAt: new Date("2022-10-11T14:23:45Z"),
      durationMs: 75_000,
    });
  });

  it("maps an in-progress workflow_run with null conclusion", () => {
    const payload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-in-progress.json",
    );

    const result = mapWorkflowRunPayload(payload, context);

    expect(result.status).toBe("in_progress");
    expect(result.conclusion).toBeNull();
    expect(result.completedAt).toBeNull();
    expect(result.durationMs).toBeNull();
    expect(result.triggerType).toBe("pull_request");
    expect(result.sourceUrl).toBe(
      "https://github.com/octocat/Hello-World/actions/runs/2891501296",
    );
  });

  it("falls back to created_at when run_started_at is absent", () => {
    const payload = loadFixture<GitHubWorkflowRunWebhookPayload>(
      "workflow-run-completed.json",
    );
    payload.workflow_run.run_started_at = null;

    const result = mapWorkflowRunPayload(payload, context);

    expect(result.startedAt).toEqual(new Date("2022-10-11T14:22:25Z"));
  });
});
