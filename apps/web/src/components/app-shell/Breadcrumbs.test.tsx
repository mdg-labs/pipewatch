import { describe, expect, it, vi } from "vitest";

import { buildBreadcrumbSegments } from "./Breadcrumbs";

const t = vi.fn((key: string) => {
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    insights: "Insights",
    settings: "Settings",
    members: "Members",
    integrations: "Integrations",
    apiKeys: "API Keys",
    billing: "Billing",
    repos: "Repositories",
    runs: "Runs",
  };
  return labels[key] ?? key;
});

describe("buildBreadcrumbSegments", () => {
  it("links the Repositories segment to the workspace dashboard", () => {
    const segments = buildBreadcrumbSegments(
      "/workspaces/acme/repos/repo-uuid-1/runs",
      "acme",
      t,
    );

    const reposSegment = segments.find((segment) => segment.label === "Repositories");
    expect(reposSegment).toEqual({
      label: "Repositories",
      href: "/workspaces/acme",
    });
  });

  it("uses repo label override for the repo segment after Repositories", () => {
    const segments = buildBreadcrumbSegments(
      "/workspaces/acme/repos/repo-uuid-1/runs/run-uuid-1",
      "acme",
      t,
      { repoLabelOverride: "mdg-labs/pipewatch" },
    );

    const repoSegment = segments.find((segment) => segment.label === "mdg-labs/pipewatch");
    expect(repoSegment).toEqual({
      label: "mdg-labs/pipewatch",
      href: "/workspaces/acme/repos/repo-uuid-1",
    });
  });

  it("falls back to title-cased path segment without repo label override", () => {
    const segments = buildBreadcrumbSegments(
      "/workspaces/acme/repos/repo-uuid-1",
      "acme",
      t,
    );

    const repoSegment = segments.find((segment) => segment.label === "Repo Uuid 1");
    expect(repoSegment).toBeDefined();
  });
});
