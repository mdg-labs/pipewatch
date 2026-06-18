"use client";

import type { PipelineJob, PipelineStep } from "@pipewatch/types";
import { StatusBadge, classNames } from "@pipewatch/ui";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { formatDuration } from "@/lib/format-duration";
import {
  isActiveJob,
  isFailedJob,
  mapPipelineJobToBadgeStatus,
} from "@/lib/run-detail-utils";

import { ElapsedTicker } from "./ElapsedTicker";
import { StepRow } from "./StepRow";

export type JobPanelProps = {
  job: PipelineJob;
  steps: PipelineStep[];
  expanded: boolean;
  highlighted?: boolean;
  onToggle: () => void;
};

export function JobPanel({
  job,
  steps,
  expanded,
  highlighted = false,
  onToggle,
}: JobPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const contentId = useId();
  const failed = isFailedJob(job);
  const active = isActiveJob(job);

  useEffect(() => {
    if (!highlighted || !panelRef.current) {
      return;
    }

    panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlighted]);

  const durationLabel =
    active && !job.duration_ms ? (
      <ElapsedTicker startedAt={job.started_at} className="pw-job-panel-elapsed" />
    ) : (
      formatDuration(job.duration_ms !== null ? Math.round(job.duration_ms / 1_000) : null)
    );

  return (
    <section
      ref={panelRef}
      id={`job-panel-${job.id}`}
      className={classNames(
        "pw-job-panel",
        failed && "pw-job-panel-failed",
        expanded && "pw-job-panel-expanded",
        highlighted && "pw-job-panel-highlighted",
      )}
      data-job-id={job.id}
    >
      <button
        type="button"
        className="pw-job-panel-header"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <StatusBadge status={mapPipelineJobToBadgeStatus(job)} showIcon />
        <span className="pw-job-panel-name">{job.name}</span>
        <span className="pw-job-panel-duration">{durationLabel}</span>
        {job.runner_name ? (
          <span className="pw-job-panel-runner">{job.runner_name}</span>
        ) : null}
        <ChevronDown
          size={14}
          className={classNames("pw-job-panel-chevron", expanded && "pw-job-panel-chevron-open")}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id={contentId} className="pw-job-panel-steps">
          {steps.length === 0 ? (
            <p className="pw-job-panel-empty">No steps recorded for this job.</p>
          ) : (
            steps.map((step) => <StepRow key={step.id} step={step} />)
          )}
        </div>
      ) : null}
    </section>
  );
}
