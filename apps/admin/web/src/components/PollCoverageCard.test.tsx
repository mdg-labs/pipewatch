import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WebhookPollCoverage } from "../api/types.js";
import { PollCoverageCard } from "./PollCoverageCard.js";

function coverage(overrides: Partial<WebhookPollCoverage> = {}): WebhookPollCoverage {
  return {
    lastDeliveryAt: "2026-06-20T08:00:00.000Z",
    lastPollAt: "2026-06-20T10:00:00.000Z",
    pollFreshnessSeconds: 60,
    ingestLagSeconds: 120,
    pollFreshnessOk: true,
    ingestLagOk: true,
    ...overrides,
  };
}

describe("PollCoverageCard", () => {
  it("shows three metric rows and helper text without warnings when healthy", () => {
    const html = renderToStaticMarkup(<PollCoverageCard coverage={coverage()} />);

    expect(html).toContain("Last delivery");
    expect(html).toContain("Poll freshness");
    expect(html).toContain("Ingest lag (newest delivery)");
    expect(html).toContain(
      "Last delivery age reflects webhook volume, not ingest health.",
    );
    expect(html).not.toContain("admin-text-warning");
  });

  it("warns when poll freshness exceeds 3 minutes", () => {
    const html = renderToStaticMarkup(
      <PollCoverageCard
        coverage={coverage({
          pollFreshnessSeconds: 240,
          pollFreshnessOk: false,
        })}
      />,
    );

    expect(html).toContain("admin-text-warning");
    expect(html).toContain("Poll freshness exceeds 3 minutes");
  });

  it("warns when ingest lag exceeds 5 minutes", () => {
    const html = renderToStaticMarkup(
      <PollCoverageCard
        coverage={coverage({
          ingestLagSeconds: 400,
          ingestLagOk: false,
        })}
      />,
    );

    expect(html).toContain("admin-text-warning");
    expect(html).toContain("Ingest lag on the newest delivery exceeds 5 minutes");
  });

  it("does not warn when last delivery is old but freshness and ingest lag are healthy", () => {
    const html = renderToStaticMarkup(
      <PollCoverageCard
        coverage={coverage({
          lastDeliveryAt: "2026-01-01T00:00:00.000Z",
          pollFreshnessSeconds: 90,
          ingestLagSeconds: 60,
        })}
      />,
    );

    expect(html).not.toContain("admin-text-warning");
  });
});
