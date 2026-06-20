import { describe, expect, it } from "vitest";

import { ONBOARDING_WIZARD_STEP_IDS } from "@/i18n/onboarding-wizard-steps";

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

  it("maps numeric steps to wizard progress ids aligned with catalog keys", () => {
    expect(stepToProgressId(1)).toBe(ONBOARDING_WIZARD_STEP_IDS[0]);
    expect(stepToProgressId(2)).toBe(ONBOARDING_WIZARD_STEP_IDS[1]);
    expect(stepToProgressId(3)).toBe(ONBOARDING_WIZARD_STEP_IDS[2]);
    expect(stepToProgressId(4)).toBe(ONBOARDING_WIZARD_STEP_IDS[3]);
  });
});
