import { describe, expect, it } from "vitest";

import {
  clampRetentionToPlan,
  getPlanLimits,
  PLAN_LIMITS,
  parseWorkspacePlan,
} from "./plan-limits.js";

describe("plan-limits", () => {
  it("exposes PRD §8 caps per tier", () => {
    expect(PLAN_LIMITS.free).toMatchObject({
      workspaceLimit: 1,
      repoLimit: 10,
      memberLimit: 1,
      maxRetentionDays: 30,
    });
    expect(PLAN_LIMITS.pro).toMatchObject({
      workspaceLimit: 3,
      repoLimit: 50,
      memberLimit: 5,
      maxRetentionDays: 365,
    });
    expect(PLAN_LIMITS.business.repoLimit).toBeNull();
  });

  it("parses workspace plan strings", () => {
    expect(parseWorkspacePlan("pro")).toBe("pro");
    expect(parseWorkspacePlan("unknown")).toBe("free");
  });

  it("clamps retention to plan max", () => {
    expect(clampRetentionToPlan("free", 90)).toBe(30);
    expect(clampRetentionToPlan("pro", 400)).toBe(365);
    expect(clampRetentionToPlan("pro", 120)).toBe(120);
  });

  it("returns plan limits via getter", () => {
    expect(getPlanLimits("business").memberLimit).toBeNull();
  });
});
