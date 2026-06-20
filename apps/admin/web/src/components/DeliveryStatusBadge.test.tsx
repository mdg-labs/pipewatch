import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WebhookDeliveryItem } from "../api/types.js";
import {
  DeliveryStatusBadge,
  deliveryOutcomeLabel,
  isUnreachableDelivery,
} from "./DeliveryStatusBadge.js";

describe("DeliveryStatusBadge", () => {
  it("renders unreachable deliveries with a failure badge", () => {
    const html = renderToStaticMarkup(
      <DeliveryStatusBadge outcome="unreachable" statusCode={0} />,
    );

    expect(html).toContain("Unreachable");
    expect(html).toContain("(0)");
  });

  it("renders success deliveries with status badge label", () => {
    const html = renderToStaticMarkup(
      <DeliveryStatusBadge outcome="success" statusCode={200} />,
    );

    expect(html).toContain("Success");
    expect(html).toContain("(200)");
  });

  it("maps outcomes to labels", () => {
    expect(deliveryOutcomeLabel("http_failure")).toBe("HTTP failure");
    expect(isUnreachableDelivery(0)).toBe(true);
    expect(isUnreachableDelivery(502)).toBe(false);
  });
});

describe("delivery table helpers", () => {
  const sampleRow: WebhookDeliveryItem = {
    id: "00000000-0000-4000-8000-000000000001",
    githubDeliveryId: "12345",
    githubGuid: "guid-1",
    externalInstallationId: "987654",
    integrationId: "00000000-0000-4000-8000-000000000002",
    workspaceId: "00000000-0000-4000-8000-000000000003",
    event: "workflow_run",
    action: "completed",
    statusCode: 0,
    status: "failed",
    duration: 1200,
    redelivery: false,
    outcome: "unreachable",
    deliveredAt: "2026-06-20T10:00:00.000Z",
    polledAt: "2026-06-20T10:01:00.000Z",
    createdAt: "2026-06-20T10:01:00.000Z",
  };

  it("identifies unreachable delivery rows", () => {
    expect(isUnreachableDelivery(sampleRow.statusCode)).toBe(true);
    expect(sampleRow.outcome).toBe("unreachable");
  });
});
