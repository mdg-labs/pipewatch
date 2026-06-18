import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { IntegrationSummary, RepositorySummary } from "@pipewatch/types";

import { IntegrationCard } from "./IntegrationCard";

const integration: IntegrationSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  provider: "github",
  external_installation_id: "12345",
  account_login: "mdg-labs",
  account_type: "Organization",
  connected_repo_count: 2,
  token_health: "healthy",
  token_expires_at: "2026-06-17T14:00:00.000Z",
  created_at: "2026-06-01T10:00:00.000Z",
};

const repos: RepositorySummary[] = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    workspace_id: integration.workspace_id,
    integration_id: integration.id,
    external_repo_id: "1",
    full_name: "mdg-labs/pipewatch",
    private: false,
    enabled: true,
    polling_interval_seconds: null,
    retention_days: null,
    last_synced_at: "2026-06-17T12:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    workspace_id: integration.workspace_id,
    integration_id: integration.id,
    external_repo_id: "2",
    full_name: "mdg-labs/docs",
    private: true,
    enabled: false,
    polling_interval_seconds: null,
    retention_days: null,
    last_synced_at: null,
  },
];

const noop = vi.fn();

function renderCard(overrides: Partial<Parameters<typeof IntegrationCard>[0]> = {}) {
  return renderToStaticMarkup(
    <IntegrationCard
      integration={integration}
      repos={repos}
      syncStatus={null}
      expanded
      readOnly={false}
      resyncing={false}
      togglingRepoId={null}
      onToggleExpand={noop}
      onResync={noop}
      onRemove={noop}
      onRepoToggle={noop}
      {...overrides}
    />,
  );
}

describe("IntegrationCard", () => {
  it("renders account summary and GitHub badge", () => {
    const html = renderCard({ expanded: false });

    expect(html).toContain("mdg-labs");
    expect(html).toContain("Org");
    expect(html).toContain("GitHub");
    expect(html).toContain("2 repos connected");
    expect(html).toContain("Connected");
  });

  it("renders per-repo enable toggles when expanded", () => {
    const html = renderCard();

    expect(html).toContain("mdg-labs/pipewatch");
    expect(html).toContain("mdg-labs/docs");
    expect(html).toContain('aria-label="Disable mdg-labs/pipewatch"');
    expect(html).toContain('aria-label="Enable mdg-labs/docs"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
  });

  it("disables repo toggles in read-only mode", () => {
    const html = renderCard({ readOnly: true });

    expect(html).not.toContain("Re-sync");
    expect(html).not.toContain("Remove");
    expect(html).toContain("disabled");
  });

  it("shows token health when expanded", () => {
    const html = renderCard();

    expect(html).toContain("Token health");
    expect(html).toContain("Healthy");
    expect(html).toContain("Last refresh due");
  });
});
