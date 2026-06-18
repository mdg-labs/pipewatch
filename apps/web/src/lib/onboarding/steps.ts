export const ONBOARDING_STEP_COUNT = 4;

export type OnboardingResumeState = {
  hasWorkspace: boolean;
  hasIntegration: boolean;
  hasEnabledRepos: boolean;
};

/** Minimum step inferred from persisted workspace state (PRD §13). */
export function minimumOnboardingStep(state: OnboardingResumeState): number {
  if (!state.hasWorkspace) {
    return 1;
  }

  if (!state.hasIntegration) {
    return 2;
  }

  if (!state.hasEnabledRepos) {
    return 3;
  }

  return 4;
}

export function clampOnboardingStep(step: number): number {
  if (!Number.isFinite(step)) {
    return 1;
  }

  return Math.min(ONBOARDING_STEP_COUNT, Math.max(1, Math.floor(step)));
}

export function parseStepParam(raw: string | undefined): number {
  if (!raw) {
    return 1;
  }

  return clampOnboardingStep(Number.parseInt(raw, 10));
}

/** Merge URL step with DB-derived minimum — never regress below completed work. */
export function resolveOnboardingStep(
  urlStep: number,
  state: OnboardingResumeState,
): number {
  const requested = clampOnboardingStep(urlStep);
  const minimum = minimumOnboardingStep(state);
  return Math.max(requested, minimum);
}

export function stepToProgressId(step: number): string {
  switch (clampOnboardingStep(step)) {
    case 1:
      return "workspace";
    case 2:
      return "github";
    case 3:
      return "repos";
    default:
      return "done";
  }
}
