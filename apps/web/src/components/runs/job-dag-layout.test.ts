import type { PipelineJob } from "@pipewatch/types";
import { describe, expect, it } from "vitest";

import {
  DAG_NODE_HEIGHT,
  DAG_NODE_WIDTH,
  groupJobsIntoWaves,
  layoutJobDag,
  resolveLayoutMetrics,
} from "@/lib/job-dag-layout";

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
    source_url: null,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: durationMs,
  };
}

const FIXED_NOW = Date.parse("2026-06-10T12:07:00.000Z");

describe("groupJobsIntoWaves", () => {
  it("places sequential jobs in separate waves", () => {
    const jobs = [
      makeJob("lint", "lint", "2026-06-10T12:00:00.000Z", "2026-06-10T12:01:00.000Z", 60_000),
      makeJob("test", "test", "2026-06-10T12:02:00.000Z", "2026-06-10T12:04:00.000Z", 120_000),
    ];

    const waves = groupJobsIntoWaves(jobs, FIXED_NOW);

    expect(waves).toHaveLength(2);
    expect(waves[0]?.map((job) => job.id)).toEqual(["lint"]);
    expect(waves[1]?.map((job) => job.id)).toEqual(["test"]);
  });

  it("groups overlapping jobs into the same wave", () => {
    const jobs = [
      makeJob("lint", "lint", "2026-06-10T12:00:00.000Z", "2026-06-10T12:03:00.000Z", 180_000),
      makeJob("typecheck", "typecheck", "2026-06-10T12:01:00.000Z", "2026-06-10T12:02:00.000Z", 60_000),
    ];

    const waves = groupJobsIntoWaves(jobs, FIXED_NOW);

    expect(waves).toHaveLength(1);
    expect(waves[0]?.map((job) => job.id)).toEqual(["lint", "typecheck"]);
  });
});

describe("resolveLayoutMetrics", () => {
  it("uses fixed intrinsic node dimensions", () => {
    const metrics = resolveLayoutMetrics(3, 1);

    expect(metrics.nodeWidth).toBe(DAG_NODE_WIDTH);
    expect(metrics.nodeHeight).toBe(DAG_NODE_HEIGHT);
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);
  });
});

describe("layoutJobDag", () => {
  const sequentialJobs = [
    makeJob("lint", "lint", "2026-06-10T12:00:00.000Z", "2026-06-10T12:01:00.000Z", 60_000),
    makeJob("test", "test", "2026-06-10T12:02:00.000Z", "2026-06-10T12:04:00.000Z", 120_000),
    makeJob("deploy", "deploy", "2026-06-10T12:05:00.000Z", "2026-06-10T12:06:00.000Z", 60_000),
  ];

  it("returns positioned nodes and connector paths", () => {
    const layout = layoutJobDag(sequentialJobs, FIXED_NOW);

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

  it("keeps intrinsic graph size regardless of container width", () => {
    const intrinsic = layoutJobDag(sequentialJobs, { nowMs: FIXED_NOW });
    const withContainer = layoutJobDag(sequentialJobs, {
      containerWidth: 960,
      nowMs: FIXED_NOW,
    });

    expect(withContainer.width).toBe(intrinsic.width);
    expect(withContainer.height).toBe(intrinsic.height);
    expect(withContainer.nodeWidth).toBe(DAG_NODE_WIDTH);
    expect(withContainer.nodeHeight).toBe(DAG_NODE_HEIGHT);
    expect(withContainer.nodeWidth).toBe(intrinsic.nodeWidth);
    expect(withContainer.nodeHeight).toBe(intrinsic.nodeHeight);
  });

  it("does not upscale nodes for wide containers", () => {
    const narrow = layoutJobDag(sequentialJobs, {
      containerWidth: 480,
      nowMs: FIXED_NOW,
    });
    const wide = layoutJobDag(sequentialJobs, {
      containerWidth: 960,
      nowMs: FIXED_NOW,
    });

    expect(wide.nodeWidth).toBe(narrow.nodeWidth);
    expect(wide.nodeHeight).toBe(narrow.nodeHeight);
    expect(wide.width).toBe(narrow.width);
  });

  it("uses identical edge paths across container widths", () => {
    const narrow = layoutJobDag(sequentialJobs, {
      containerWidth: 480,
      nowMs: FIXED_NOW,
    });
    const wide = layoutJobDag(sequentialJobs, {
      containerWidth: 960,
      nowMs: FIXED_NOW,
    });

    expect(narrow.edges[0]?.path).toBe(wide.edges[0]?.path);
    expect(narrow.edges).toHaveLength(wide.edges.length);
  });

  it("grows graph width with more sequential columns", () => {
    const threeColumn = layoutJobDag(sequentialJobs, { nowMs: FIXED_NOW });
    const manyColumnJobs = Array.from({ length: 6 }, (_, index) =>
      makeJob(
        `job-${index}`,
        `job-${index}`,
        `2026-06-10T12:0${index}:00.000Z`,
        `2026-06-10T12:0${index + 1}:00.000Z`,
        60_000,
      ),
    );
    const sixColumn = layoutJobDag(manyColumnJobs, { nowMs: FIXED_NOW });

    expect(sixColumn.width).toBeGreaterThan(threeColumn.width);
    expect(sixColumn.nodeWidth).toBe(DAG_NODE_WIDTH);
  });
});
