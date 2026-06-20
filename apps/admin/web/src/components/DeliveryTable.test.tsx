import { describe, expect, it } from "vitest";

import type { WebhookDeliveryItem } from "../api/types.js";
import { isUnreachableDelivery } from "./DeliveryStatusBadge.js";
import { deliveryRowClassName } from "./DeliveryTable.js";

const sampleDelivery: WebhookDeliveryItem = {
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

describe("DeliveryTable", () => {
  it("marks unreachable rows with highlight class", () => {
    expect(deliveryRowClassName(sampleDelivery.statusCode)).toBe(
      "admin-row-unreachable",
    );
    expect(isUnreachableDelivery(sampleDelivery.statusCode)).toBe(true);
  });

  it("does not highlight successful deliveries", () => {
    expect(deliveryRowClassName(200)).toBe("");
  });
});
