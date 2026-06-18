import { describe, expect, it } from "vitest";

import {
  parseRunFilters,
  runFiltersQueryString,
  runsApiQueryString,
  toRunsApiQuery,
  withUpdatedRunFilters,
} from "./run-filters";

describe("parseRunFilters", () => {
  it("returns defaults when search params are empty", () => {
    expect(parseRunFilters(new URLSearchParams())).toEqual({
      branch: undefined,
      workflow: undefined,
      status: "all",
      trigger: undefined,
      range: "30d",
      page: 1,
      cursor: undefined,
    });
  });

  it("parses URL-encoded filter values", () => {
    const params = new URLSearchParams();
    params.set("branch", "feature/x");
    params.set("workflow", "CI");
    params.set("status", "failed");
    params.set("trigger", "pull_request");
    params.set("range", "7d");
    params.set("page", "2");
    params.set("cursor", "abc123");

    expect(parseRunFilters(params)).toEqual({
      branch: "feature/x",
      workflow: "CI",
      status: "failed",
      trigger: "pull_request",
      range: "7d",
      page: 2,
      cursor: "abc123",
    });
  });
});

describe("runFiltersQueryString", () => {
  it("omits default values from the query string", () => {
    expect(
      runFiltersQueryString({
        branch: undefined,
        workflow: undefined,
        status: "all",
        trigger: undefined,
        range: "30d",
        page: 1,
        cursor: undefined,
      }),
    ).toBe("");
  });

  it("serializes active filters for shareable URLs", () => {
    expect(
      runFiltersQueryString({
        branch: "main",
        workflow: "Deploy",
        status: "running",
        trigger: "push",
        range: "90d",
        page: 2,
        cursor: "cursor-token",
      }),
    ).toBe(
      "?branch=main&workflow=Deploy&status=running&trigger=push&range=90d&page=2&cursor=cursor-token",
    );
  });
});

describe("toRunsApiQuery", () => {
  it("maps UI filters to pipeline runs API query params", () => {
    const query = toRunsApiQuery({
      branch: "main",
      workflow: "CI",
      status: "running",
      trigger: "push",
      range: "7d",
      page: 2,
      cursor: "opaque-cursor",
    });

    expect(query.branch).toBe("main");
    expect(query.workflow).toBe("CI");
    expect(query.status).toBe("in_progress");
    expect(query.trigger).toBe("push");
    expect(query.page_size).toBe(20);
    expect(query.cursor).toBe("opaque-cursor");
    expect(query.started_from).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("builds a request query string for the API client", () => {
    const queryString = runsApiQueryString({
      branch: "develop",
      workflow: undefined,
      status: "all",
      trigger: undefined,
      range: "30d",
      page: 1,
      cursor: undefined,
    });

    expect(queryString).toContain("branch=develop");
    expect(queryString).toContain("page_size=20");
    expect(queryString).toContain("started_from=");
    expect(queryString).not.toContain("status=");
  });
});

describe("withUpdatedRunFilters", () => {
  it("resets pagination when filters change", () => {
    const current = {
      branch: "main",
      workflow: "CI",
      status: "all" as const,
      trigger: undefined,
      range: "30d" as const,
      page: 3,
      cursor: "page-3-cursor",
    };

    expect(withUpdatedRunFilters(current, { status: "failed" })).toEqual({
      ...current,
      status: "failed",
      page: 1,
      cursor: undefined,
    });
  });

  it("clears cursor when returning to page 1", () => {
    const current = {
      branch: undefined,
      workflow: undefined,
      status: "all" as const,
      trigger: undefined,
      range: "30d" as const,
      page: 2,
      cursor: "page-2-cursor",
    };

    expect(withUpdatedRunFilters(current, { page: 1 })).toEqual({
      ...current,
      page: 1,
      cursor: undefined,
    });
  });
});
