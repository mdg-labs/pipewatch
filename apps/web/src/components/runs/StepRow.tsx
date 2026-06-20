"use client";

import type { PipelineStep } from "@pipewatch/types";
import { StatusBadge } from "@pipewatch/ui";

import { useTimeFormatters } from "@/i18n/use-time-formatters";
import {
  isFailedStep,
  mapPipelineJobToBadgeStatus,
} from "@/lib/run-detail-utils";

export type StepRowProps = {
  step: PipelineStep;
};

export function StepRow({ step }: StepRowProps) {
  const { formatDuration } = useTimeFormatters();
  const failed = isFailedStep(step);

  return (
    <div
      className={failed ? "pw-step-row pw-step-row-failed" : "pw-step-row"}
      data-step-id={step.id}
    >
      <span className="pw-step-row-number">{step.number}</span>
      <span className="pw-step-row-name">{step.name}</span>
      <StatusBadge status={mapPipelineJobToBadgeStatus(step)} />
      <span className="pw-step-row-duration">
        {formatDuration(
          step.duration_ms !== null ? Math.round(step.duration_ms / 1_000) : null,
        )}
      </span>
    </div>
  );
}
