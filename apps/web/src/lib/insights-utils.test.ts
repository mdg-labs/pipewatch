import { describe, expect, it } from "vitest";

import {
  buildInsightsPath,
  insightsApiQueryString,
  parseInsightsFilters,
  withUpdatedInsightsFilters,
} from "@/lib/insights-filters";
import {
  buildWorkflowRunsHref,
  hasInsightsData,
  rankWorkflowKeys,
  resolveTrendTone,
} from "@/lib/insights-utils";
import {
  formatChartDateLabel,
  formatMsAsDuration,
} from "@/i18n/insights-formatters";

describe("insights-filters", () => {
  it("parses range, repo, and workflow from the URL", () => {
    const params = new URLSearchParams(
      "range=30d&repoId=11111111-1111-4111-8111-111111111111&workflow=CI",
    );

    expect(parseInsightsFilters(params)).toEqual({
      range: "30d",
      repoId: "11111111-1111-4111-8111-111111111111",
      workflow: "CI",
    });
  });

  it("defaults to 7d when range is missing or invalid", () => {
    expect(parseInsightsFilters(new URLSearchParams())).toEqual({
      range: "7d",
      repoId: undefined,
      workflow: undefined,
    });
  });

  it("serializes filters for the insights API and route", () => {
    const filters = {
      range: "30d" as const,
      repoId: "11111111-1111-4111-8111-111111111111",
      workflow: "Deploy",
    };

    expect(insightsApiQueryString(filters)).toBe(
      "range=30d&repoId=11111111-1111-4111-8111-111111111111&workflow=Deploy",
    );
    expect(buildInsightsPath("acme", filters)).toBe(
      "/workspaces/acme/insights?range=30d&repoId=11111111-1111-4111-8111-111111111111&workflow=Deploy",
    );
  });

  it("clears workflow when the repository filter changes", () => {
    const current = {
      range: "7d" as const,
      repoId: "11111111-1111-4111-8111-111111111111",
      workflow: "CI",
    };

    expect(
      withUpdatedInsightsFilters(current, {
        repoId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toEqual({
      range: "7d",
      repoId: "22222222-2222-4222-8222-222222222222",
      workflow: undefined,
    });
  });
});

describe("insights-utils", () => {
  it("formats chart labels and durations", () => {
    expect(formatChartDateLabel("2026-06-18")).toBe("Jun 18");
    expect(formatMsAsDuration(154_000)).toBe("2m 34s");
  });

  it("ranks workflow series by total activity", () => {
    const keys = rankWorkflowKeys([
      {
        date: "2026-06-17",
        points: [
          {
            workflow: "CI",
            repo_id: "11111111-1111-4111-8111-111111111111",
            repo_full_name: "acme/app",
            value: 10,
          },
          {
            workflow: "Deploy",
            repo_id: "11111111-1111-4111-8111-111111111111",
            repo_full_name: "acme/app",
            value: 3,
          },
        ],
      },
      {
        date: "2026-06-18",
        points: [
          {
            workflow: "CI",
            repo_id: "11111111-1111-4111-8111-111111111111",
            repo_full_name: "acme/app",
            value: 8,
          },
        ],
      },
    ]);

    expect(keys).toEqual([
      "11111111-1111-4111-8111-111111111111:CI",
      "11111111-1111-4111-8111-111111111111:Deploy",
    ]);
  });

  it("detects empty insights payloads", () => {
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

  it("builds deep links to the run list with workflow filters", () => {
    expect(
      buildWorkflowRunsHref(
        "acme",
        "11111111-1111-4111-8111-111111111111",
        "CI",
        "30d",
      ),
    ).toBe(
      "/workspaces/acme/repos/11111111-1111-4111-8111-111111111111?workflow=CI",
    );
  });

  it("resolves trend tone from value direction", () => {
    expect(resolveTrendTone(12, true)).toBe("up");
    expect(resolveTrendTone(-4, true)).toBe("down");
    expect(resolveTrendTone(0, true)).toBe("neutral");
  });
});
