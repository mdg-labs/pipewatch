import { describe, expect, it } from "vitest";

import {
  buildRepoOverviewPath,
  buildViewAllRunsHref,
  parseRepoOverviewFilters,
  repoOverviewInsightsApiQueryString,
} from "@/lib/repo-overview-filters";
import { hasInsightsData } from "@/lib/insights-utils";

describe("repo-overview-filters", () => {
  it("parses range from the URL and defaults to 7d", () => {
    expect(parseRepoOverviewFilters(new URLSearchParams("range=30d"))).toEqual({ range: "30d" });
    expect(parseRepoOverviewFilters(new URLSearchParams())).toEqual({ range: "7d" });
    expect(parseRepoOverviewFilters(new URLSearchParams("range=invalid"))).toEqual({ range: "7d" });
  });

  it("builds shareable overview and runs list URLs", () => {
    const repoId = "11111111-1111-4111-8111-111111111111";

    expect(buildRepoOverviewPath("acme", repoId, { range: "30d" })).toBe(
      `/workspaces/acme/repos/${repoId}?range=30d`,
    );
    expect(buildViewAllRunsHref("acme", repoId)).toBe(`/workspaces/acme/repos/${repoId}/runs`);
  });

  it("serializes insights API query for the repo overview", () => {
    const repoId = "11111111-1111-4111-8111-111111111111";

    expect(repoOverviewInsightsApiQueryString(repoId, { range: "7d" })).toBe(
      `range=7d&repoId=${repoId}`,
    );
  });
});

describe("repo overview empty-state guard", () => {
  it("shows empty state when insights report zero runs", () => {
    expect(
      hasInsightsData({
        range: "7d",
        summary: {
          total_runs: 0,
          success_rate: 0,
          avg_duration_ms: null,
          most_active_repo: null,
          trends: {
            total_runs_percent: null,
            success_rate_points: null,
            avg_duration_percent: null,
          },
        },
        time_series: { duration: [], failure_rate: [] },
        slowest_workflows: [],
        most_failing_workflows: [],
      }),
    ).toBe(false);
  });
});
