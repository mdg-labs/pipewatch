"use client";

import type { PipelineStep } from "@pipewatch/types";
import { StatusBadge } from "@pipewatch/ui";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTimeFormatters } from "@/i18n/use-time-formatters";
import {
  isFailedStep,
  mapPipelineJobToBadgeStatus,
} from "@/lib/run-detail-utils";

export type StepRowProps = {
  step: PipelineStep;
  jobSourceUrl?: string | null;
};

export function StepRow({ step, jobSourceUrl }: StepRowProps) {
  const t = useTranslations("runs.stepRow");
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
      {jobSourceUrl ? (
        <a
          href={jobSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pw-step-row-log-link"
          aria-label={t("viewLogsAriaLabel", { name: step.name })}
        >
          <ExternalLink size={12} aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
