import { describe, expect, it } from "vitest";

import type { DashboardRepoCard, WorkspaceDashboard } from "./dashboard-types";
import {
  applySseEventToDashboard,
  averageFailureRate,
  classifyRepoHealth,
  filterDashboardRepos,
  mapRunToBadgeStatus,
  parseRepoFullName,
  sortDashboardRepos,
} from "./dashboard-utils";

const baseLastRun: DashboardRepoCard["last_run"] = {
  id: "run-1",
  external_run_id: "ext-1",
  pipeline_name: "CI",
  status: "completed",
  conclusion: "success",
  branch: "main",
  commit_sha: "abc123",
  commit_message: null,
  actor_login: "dev",
  trigger_type: "push",
  source_url: "https://github.com/acme/app/actions/runs/1",
  started_at: "2026-06-18T10:00:00.000Z",
  completed_at: "2026-06-18T10:05:00.000Z",
  duration_ms: 300_000,
};

function makeRepo(overrides: Partial<DashboardRepoCard> = {}): DashboardRepoCard {
  return {
    id: "repo-1",
    full_name: "acme/app",
    integration_id: "int-1",
    is_running: false,
    health: "healthy",
    last_run: baseLastRun,
    sparkline: [0, 10, 0, 5, 0, 0, 20],
    ...overrides,
  };
}

describe("parseRepoFullName", () => {
  it("splits org and repository name", () => {
    expect(parseRepoFullName("mdg-labs/pipewatch")).toEqual({
      org: "mdg-labs",
      name: "pipewatch",
    });
  });
});

describe("mapRunToBadgeStatus", () => {
  it("maps running repos to running badge", () => {
    expect(mapRunToBadgeStatus(baseLastRun, true)).toBe("running");
  });

  it("maps failed conclusions to failure badge", () => {
    expect(
      mapRunToBadgeStatus(
        { ...baseLastRun, conclusion: "failure", status: "completed" },
        false,
      ),
    ).toBe("failure");
  });
});

describe("classifyRepoHealth", () => {
  it("returns running when active", () => {
    expect(classifyRepoHealth(true, baseLastRun)).toBe("running");
  });

  it("returns failing for failed last run", () => {
    expect(
      classifyRepoHealth(false, {
        ...baseLastRun,
        conclusion: "failure",
        status: "completed",
      }),
    ).toBe("failing");
  });
});

describe("averageFailureRate", () => {
  it("averages sparkline values", () => {
    expect(averageFailureRate([0, 10, 20])).toBe(10);
  });
});

describe("filterDashboardRepos", () => {
  const repos = [
    makeRepo({ id: "1", health: "healthy" }),
    makeRepo({ id: "2", health: "failing", integration_id: "int-2" }),
    makeRepo({ id: "3", health: "running" }),
  ];

  it("filters by health", () => {
    expect(filterDashboardRepos(repos, "failing", null)).toHaveLength(1);
  });

  it("filters by integration", () => {
    expect(filterDashboardRepos(repos, "all", "int-2")).toHaveLength(1);
  });
});

describe("sortDashboardRepos", () => {
  it("sorts by name", () => {
    const repos = [
      makeRepo({ id: "1", full_name: "zeta/repo" }),
      makeRepo({ id: "2", full_name: "alpha/repo" }),
    ];

    expect(sortDashboardRepos(repos, "name").map((repo) => repo.full_name)).toEqual([
      "alpha/repo",
      "zeta/repo",
    ]);
  });

  it("sorts by failure rate descending", () => {
    const repos = [
      makeRepo({ id: "1", sparkline: [0, 0, 0] }),
      makeRepo({ id: "2", sparkline: [50, 50, 50] }),
    ];

    expect(sortDashboardRepos(repos, "failure_rate")[0]?.id).toBe("2");
  });
});

describe("applySseEventToDashboard", () => {
  it("updates repo health from run events", () => {
    const dashboard: WorkspaceDashboard = {
      health: { healthy: 1, running: 0, failing: 0, total: 1 },
      repos: [makeRepo()],
    };

    const updated = applySseEventToDashboard(dashboard, "repo-1", {
      type: "run:updated",
      data: {
        id: "run-2",
        pipelineName: "Deploy",
        status: "in_progress",
        conclusion: null,
        branch: "main",
        startedAt: "2026-06-18T11:00:00.000Z",
        durationMs: null,
      },
    });

    expect(updated.repos[0]?.health).toBe("running");
    expect(updated.repos[0]?.is_running).toBe(true);
    expect(updated.health.running).toBe(1);
  });
});
