import type { CSSProperties } from "react";

import { Check } from "lucide-react";

import { classNames } from "../lib/class-names.js";

export type WizardStepState = "complete" | "active" | "upcoming";

export interface WizardStep {
  id: string;
  label: string;
  title: string;
}

export interface WizardProgressProps {
  steps: WizardStep[];
  currentStepId: string;
  className?: string;
  style?: CSSProperties;
}

export function wizardProgressClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-wizard-progress", className);
}

function getStepState(
  stepIndex: number,
  currentIndex: number,
): WizardStepState {
  if (stepIndex < currentIndex) {
    return "complete";
  }

  if (stepIndex === currentIndex) {
    return "active";
  }

  return "upcoming";
}

export function WizardProgress({
  steps,
  currentStepId,
  className,
  style,
}: WizardProgressProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStepId),
  );

  return (
    <div
      className={wizardProgressClassName({ className })}
      style={style}
      aria-label="Onboarding progress"
    >
      {steps.map((step, index) => {
        const state = getStepState(index, currentIndex);
        const isLast = index === steps.length - 1;
        const connectorState =
          index < currentIndex ? "complete" : "upcoming";

        return (
          <div key={step.id} className="pw-wizard-progress-segment">
            <div
              className={classNames(
                "pw-wizard-progress-step",
                `pw-wizard-progress-step-${state}`,
              )}
            >
              <div
                className={classNames(
                  "pw-wizard-progress-indicator",
                  `pw-wizard-progress-indicator-${state}`,
                )}
                aria-hidden
              >
                {state === "complete" ? (
                  <Check size={12} strokeWidth={2} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="pw-wizard-progress-copy">
                <div className="pw-wizard-progress-label">{step.label}</div>
                <div className="pw-wizard-progress-title">{step.title}</div>
              </div>
            </div>
            {!isLast ? (
              <div
                className={classNames(
                  "pw-wizard-progress-connector",
                  `pw-wizard-progress-connector-${connectorState}`,
                )}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const DEFAULT_ONBOARDING_STEPS: WizardStep[] = [
  { id: "workspace", label: "Step 1", title: "Create workspace" },
  { id: "github", label: "Step 2", title: "Connect GitHub" },
  { id: "repos", label: "Step 3", title: "Select repos" },
  { id: "done", label: "Step 4", title: "Done" },
];
