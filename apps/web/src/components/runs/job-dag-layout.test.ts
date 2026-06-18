import type { PipelineJob } from "@pipewatch/types";
import { describe, expect, it } from "vitest";

import { groupJobsIntoWaves, layoutJobDag } from "@/lib/job-dag-layout";

function makeJob(
  id: string,
  name: string,
  startedAt: string,
  completedAt: string | null,
  durationMs: number | null = null,
): PipelineJob {
  return {
    id,
    workspace_id: "ws-1",
    run_id: "run-1",
    external_job_id: id,
    name,
    status: completedAt ? "completed" : "in_progress",
    conclusion: completedAt ? "success" : null,
    runner_name: "ubuntu-latest",
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: durationMs,
  };
}

describe("groupJobsIntoWaves", () => {
  it("places sequential jobs in separate waves", () => {
    const jobs = [
      makeJob("lint", "lint", "2026-06-10T12:00:00.000Z", "2026-06-10T12:01:00.000Z", 60_000),
      makeJob("test", "test", "2026-06-10T12:02:00.000Z", "2026-06-10T12:04:00.000Z", 120_000),
    ];

    const waves = groupJobsIntoWaves(jobs, Date.parse("2026-06-10T12:05:00.000Z"));

    expect(waves).toHaveLength(2);
    expect(waves[0]?.map((job) => job.id)).toEqual(["lint"]);
    expect(waves[1]?.map((job) => job.id)).toEqual(["test"]);
  });

  it("groups overlapping jobs into the same wave", () => {
    const jobs = [
      makeJob("lint", "lint", "2026-06-10T12:00:00.000Z", "2026-06-10T12:03:00.000Z", 180_000),
      makeJob("typecheck", "typecheck", "2026-06-10T12:01:00.000Z", "2026-06-10T12:02:00.000Z", 60_000),
    ];

    const waves = groupJobsIntoWaves(jobs, Date.parse("2026-06-10T12:05:00.000Z"));

    expect(waves).toHaveLength(1);
    expect(waves[0]?.map((job) => job.id)).toEqual(["lint", "typecheck"]);
  });
});

describe("layoutJobDag", () => {
  it("returns positioned nodes and connector paths", () => {
    const jobs = [
      makeJob("lint", "lint", "2026-06-10T12:00:00.000Z", "2026-06-10T12:01:00.000Z", 60_000),
      makeJob("test", "test", "2026-06-10T12:02:00.000Z", "2026-06-10T12:04:00.000Z", 120_000),
      makeJob("deploy", "deploy", "2026-06-10T12:05:00.000Z", "2026-06-10T12:06:00.000Z", 60_000),
    ];

    const layout = layoutJobDag(jobs, Date.parse("2026-06-10T12:07:00.000Z"));

    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(2);
    expect(layout.nodes[0]?.column).toBe(0);
    expect(layout.nodes[1]?.column).toBe(1);
    expect(layout.nodes[2]?.column).toBe(2);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.edges[0]?.path.startsWith("M ")).toBe(true);
  });

  it("returns empty layout for no jobs", () => {
    const layout = layoutJobDag([]);

    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });
});
