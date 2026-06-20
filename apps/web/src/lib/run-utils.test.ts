import { describe, expect, it } from "vitest";

import type { PipelineRun, PipelineRunSummary } from "@pipewatch/types";

import {
  applySseEventToRuns,
  formatBranchDisplay,
  formatPipelineNameDisplay,
} from "./run-utils";

const context = { repoId: "repo-1", workspaceId: "ws-1" };

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

describe("formatPipelineNameDisplay", () => {
  it("returns the pipeline name when present", () => {
    expect(formatPipelineNameDisplay("CI")).toBe("CI");
  });

  it("uses the locale em dash for empty values", () => {
    expect(formatPipelineNameDisplay(null)).toBe("—");
    expect(formatPipelineNameDisplay("  ", "–")).toBe("–");
  });
});

describe("formatBranchDisplay", () => {
  it("returns the branch when present", () => {
    expect(formatBranchDisplay("main")).toBe("main");
  });

  it("uses the locale em dash for empty values", () => {
    expect(formatBranchDisplay(undefined)).toBe("—");
    expect(formatBranchDisplay("", "–")).toBe("–");
  });
});

describe("applySseEventToRuns", () => {
  it("sets completed_at from summary.completedAt on run:completed", () => {
    const runs = [makeRun()];

    const updated = applySseEventToRuns(
      runs,
      {
        type: "run:completed",
        data: makeSummary({
          status: "completed",
          startedAt: "2026-06-18T10:00:00.000Z",
          completedAt: "2026-06-18T10:05:00.000Z",
        }),
      },
      context,
    );

    expect(updated[0]?.completed_at).toBe("2026-06-18T10:05:00.000Z");
    expect(updated[0]?.completed_at).not.toBe(updated[0]?.started_at);
  });

  it("keeps completed_at null for in-progress SSE updates", () => {
    const runs = [makeRun()];

    const updated = applySseEventToRuns(
      runs,
      {
        type: "run:updated",
        data: makeSummary({
          status: "in_progress",
          conclusion: null,
          completedAt: null,
          durationMs: null,
        }),
      },
      context,
    );

    expect(updated[0]?.completed_at).toBeNull();
    expect(updated[0]?.status).toBe("in_progress");
  });

  it("falls back to existing completed_at when summary omits it on completed runs", () => {
    const runs = [
      makeRun({
        status: "completed",
        conclusion: "success",
        completed_at: "2026-06-18T10:04:00.000Z",
      }),
    ];

    const updated = applySseEventToRuns(
      runs,
      {
        type: "run:updated",
        data: makeSummary({
          status: "completed",
          completedAt: null,
        }),
      },
      context,
    );

    expect(updated[0]?.completed_at).toBe("2026-06-18T10:04:00.000Z");
  });
});
