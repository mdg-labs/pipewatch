import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlatformMetricsSummary } from "../api/types.js";
import { OverviewStatCards } from "./OverviewStatCards.js";

const sampleSummary: PlatformMetricsSummary = {
  totalWorkspaces: 42,
  totalIntegrations: 17,
  totalProductUsers: 128,
  totalPipelineRuns: 9_500,
  pipelineRunsLast30Days: 1_240,
  workspacesByPlan: {
    free: 30,
    pro: 10,
    business: 2,
  },
};

describe("OverviewStatCards", () => {
  it("renders platform stat card labels and formatted values", () => {
    const html = renderToStaticMarkup(
      <OverviewStatCards summary={sampleSummary} />,
    );

    expect(html).toContain("Workspaces");
    expect(html).toContain("42");
    expect(html).toContain("Product users");
    expect(html).toContain("128");
    expect(html).toContain("Pipeline runs");
    expect(html).toContain("9,500");
    expect(html).toContain("1,240 in last 30 days");
    expect(html).toContain("Integrations");
    expect(html).toContain("17");
  });
});
