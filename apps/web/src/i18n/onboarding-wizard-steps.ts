import type { WizardStep } from "@pipewatch/ui";

export const ONBOARDING_WIZARD_STEP_IDS = [
  "workspace",
  "github",
  "repos",
  "done",
] as const;

export type OnboardingWizardStepId = (typeof ONBOARDING_WIZARD_STEP_IDS)[number];

export function buildOnboardingWizardSteps(
  labels: Record<OnboardingWizardStepId, { label: string; title: string }>,
): WizardStep[] {
  return ONBOARDING_WIZARD_STEP_IDS.map((id) => ({
    id,
    label: labels[id].label,
    title: labels[id].title,
  }));
}
