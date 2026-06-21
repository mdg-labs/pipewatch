import { describe, expect, it } from "vitest";

import type { PipelineJob, PipelineRun, PipelineRunSummary } from "@pipewatch/types";

import {
  applySseEventToRunDetail,
  buildRunDetailBreadcrumbHrefs,
} from "./run-detail-utils";

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    id: "run-1",
    workspace_id: "ws-1",
    repo_id: "repo-1",
    external_run_id: "ext-1",
    pipeline_name: "CI",
    pipeline_definition_ref: ".github/workflows/ci.yml",
    status: "in_progress",
    conclusion: null,
    branch: "main",
    commit_sha: "abc123",
    commit_message: null,
    actor_login: "dev",
    trigger_type: "push",
    source_url: "https://github.com/acme/app/actions/runs/1",
    started_at: "2026-06-18T10:00:00.000Z",
    completed_at: null,
    duration_ms: null,
    created_at: "2026-06-18T10:00:00.000Z",
    ...overrides,
  };
}

function makeSummary(overrides: Partial<PipelineRunSummary> = {}): PipelineRunSummary {
  return {
    id: "run-1",
    pipelineName: "CI",
    status: "completed",
    conclusion: "success",
    branch: "main",
    startedAt: "2026-06-18T10:00:00.000Z",
    completedAt: "2026-06-18T10:05:00.000Z",
    durationMs: 300_000,
    ...overrides,
  };
}

describe("buildRunDetailBreadcrumbHrefs", () => {
  it("links dashboard, repo overview, and all runs list", () => {
    const repoId = "11111111-1111-4111-8111-111111111111";

    expect(buildRunDetailBreadcrumbHrefs("acme", repoId)).toEqual({
      dashboard: "/workspaces/acme",
      repoOverview: `/workspaces/acme/repos/${repoId}`,
      allRuns: `/workspaces/acme/repos/${repoId}/runs`,
    });
  });
});

describe("applySseEventToRunDetail", () => {
  it("sets completed_at from summary.completedAt on run:completed", () => {
    const state = { run: makeRun(), jobs: [] as PipelineJob[] };

    const updated = applySseEventToRunDetail(
      state,
      {
        type: "run:completed",
        data: makeSummary({
          status: "completed",
          startedAt: "2026-06-18T10:00:00.000Z",
          completedAt: "2026-06-18T10:05:00.000Z",
        }),
      },
      "run-1",
    );

    expect(updated.run.completed_at).toBe("2026-06-18T10:05:00.000Z");
    expect(updated.run.completed_at).not.toBe(updated.run.started_at);
  });

  it("clears completed_at for in-progress SSE updates", () => {
    const state = {
      run: makeRun({
        status: "completed",
        conclusion: "success",
        completed_at: "2026-06-18T10:05:00.000Z",
      }),
      jobs: [] as PipelineJob[],
    };

    const updated = applySseEventToRunDetail(
      state,
      {
        type: "run:updated",
        data: makeSummary({
          status: "in_progress",
          conclusion: null,
          completedAt: null,
          durationMs: null,
        }),
      },
      "run-1",
    );

    expect(updated.run.completed_at).toBeNull();
    expect(updated.run.status).toBe("in_progress");
  });

  it("ignores run events for a different run id", () => {
    const state = { run: makeRun(), jobs: [] as PipelineJob[] };

    const updated = applySseEventToRunDetail(
      state,
      {
        type: "run:completed",
        data: makeSummary({ id: "run-2", completedAt: "2026-06-18T11:00:00.000Z" }),
      },
      "run-1",
    );

    expect(updated).toBe(state);
  });
});
