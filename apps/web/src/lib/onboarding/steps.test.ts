import { describe, expect, it } from "vitest";

import {
  minimumOnboardingStep,
  parseStepParam,
  resolveOnboardingStep,
  stepToProgressId,
} from "./steps";

describe("onboarding steps", () => {
  it("parses and clamps URL step params", () => {
    expect(parseStepParam("3")).toBe(3);
    expect(parseStepParam("9")).toBe(4);
    expect(parseStepParam(undefined)).toBe(1);
  });

  it("infers minimum step from persisted state", () => {
    expect(
      minimumOnboardingStep({
        hasWorkspace: false,
        hasIntegration: false,
        hasEnabledRepos: false,
      }),
    ).toBe(1);

    expect(
      minimumOnboardingStep({
        hasWorkspace: true,
        hasIntegration: false,
        hasEnabledRepos: false,
      }),
    ).toBe(2);

    expect(
      minimumOnboardingStep({
        hasWorkspace: true,
        hasIntegration: true,
        hasEnabledRepos: false,
      }),
    ).toBe(3);
  });

  it("never regresses below completed work", () => {
    expect(
      resolveOnboardingStep(1, {
        hasWorkspace: true,
        hasIntegration: true,
        hasEnabledRepos: false,
      }),
    ).toBe(3);
  });

  it("maps numeric steps to wizard progress ids", () => {
    expect(stepToProgressId(1)).toBe("workspace");
    expect(stepToProgressId(4)).toBe("done");
  });
});
