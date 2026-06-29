"use client";

import { useEffect, useRef, useState } from "react";

import type { PipelineJob } from "@pipewatch/types";
import { StatusBadge, classNames } from "@pipewatch/ui";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTimeFormatters } from "@/i18n/use-time-formatters";
import {
  layoutJobDag,
  type DagNodeLayout,
} from "@/lib/job-dag-layout";
import {
  isActiveJob,
  mapPipelineJobToBadgeStatus,
} from "@/lib/run-detail-utils";

import { ElapsedTicker } from "./ElapsedTicker";

export type JobGraphProps = {
  jobs: PipelineJob[];
  selectedJobId?: string | null;
  onJobSelect: (jobId: string) => void;
};

function toPercent(value: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return `${(value / total) * 100}%`;
}

function scrollToJobPanel(jobId: string): void {
  const panel = document.getElementById(`job-panel-${jobId}`);
  panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function JobGraphNode({
  job,
  layout,
  nodeWidth,
  nodeHeight,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  formatDuration,
  jobAriaLabel,
  viewLogsAriaLabel,
}: {
  job: PipelineJob;
  layout: DagNodeLayout;
  nodeWidth: number;
  nodeHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  onSelect: () => void;
  formatDuration: (totalSeconds: number | null | undefined) => string;
  jobAriaLabel: (name: string) => string;
  viewLogsAriaLabel: (name: string) => string;
}) {
  const active = isActiveJob(job);
  const badgeStatus = mapPipelineJobToBadgeStatus(job);
  const failed = badgeStatus === "failure";
  const skipped = badgeStatus === "skipped";

  const durationLabel =
    active && !job.duration_ms ? (
      <ElapsedTicker startedAt={job.started_at} className="pw-job-graph-node-duration" />
    ) : (
      formatDuration(job.duration_ms !== null ? Math.round(job.duration_ms / 1_000) : null)
    );

  return (
    <div
      className="pw-job-graph-node-wrap"
      style={{
        left: toPercent(layout.x, canvasWidth),
        top: toPercent(layout.y, canvasHeight),
        width: toPercent(nodeWidth, canvasWidth),
        height: toPercent(nodeHeight, canvasHeight),
      }}
    >
      <button
        type="button"
        className={classNames(
          "pw-job-graph-node",
          failed && "pw-job-graph-node-failed",
          skipped && "pw-job-graph-node-skipped",
          selected && "pw-job-graph-node-selected",
        )}
        onClick={() => {
          onSelect();
          scrollToJobPanel(job.id);
        }}
        aria-pressed={selected}
        aria-label={jobAriaLabel(job.name)}
      >
        <div className="pw-job-graph-node-header">
          <span className="pw-job-graph-node-name">{job.name}</span>
          <span className="pw-job-graph-node-duration">{durationLabel}</span>
        </div>
        <StatusBadge status={badgeStatus} />
        {job.runner_name ? (
          <span className="pw-job-graph-node-runner">{job.runner_name}</span>
        ) : null}
      </button>
      {job.source_url ? (
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="pw-job-graph-node-log-link"
          aria-label={viewLogsAriaLabel(job.name)}
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink size={12} aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

export function JobGraph({ jobs, selectedJobId, onJobSelect }: JobGraphProps) {
  const t = useTranslations("runs.jobGraph");
  const { formatDuration } = useTimeFormatters();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    setContainerWidth(element.getBoundingClientRect().width);

    return () => {
      observer.disconnect();
    };
  }, []);

  const layout = layoutJobDag(
    jobs,
    containerWidth === undefined ? {} : { containerWidth },
  );
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="pw-job-graph">
      <h2 className="pw-run-section-title">{t("title")}</h2>
      <div ref={wrapRef} className="pw-job-graph-canvas-wrap">
        <div
          className="pw-job-graph-canvas"
          style={{ height: layout.height }}
        >
          <svg
            className="pw-job-graph-edges"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            {layout.edges.map((edge) => {
              const toJob = jobById.get(edge.toJobId);
              const dashed = toJob ? mapPipelineJobToBadgeStatus(toJob) === "skipped" : false;

              return (
                <path
                  key={`${edge.fromJobId}-${edge.toJobId}`}
                  d={edge.path}
                  className={classNames(
                    "pw-job-graph-edge",
                    dashed && "pw-job-graph-edge-skipped",
                  )}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  markerEnd={dashed ? "url(#pw-dag-arrow-skipped)" : "url(#pw-dag-arrow)"}
                />
              );
            })}
            <defs>
              <marker
                id="pw-dag-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,1 L0,7 L7,4 z" className="pw-job-graph-arrow" />
              </marker>
              <marker
                id="pw-dag-arrow-skipped"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,1 L0,7 L7,4 z" className="pw-job-graph-arrow-skipped" />
              </marker>
            </defs>
          </svg>

          {layout.nodes.map((node) => {
            const job = jobById.get(node.jobId);
            if (!job) {
              return null;
            }

            return (
              <JobGraphNode
                key={job.id}
                job={job}
                layout={node}
                nodeWidth={layout.nodeWidth}
                nodeHeight={layout.nodeHeight}
                canvasWidth={layout.width}
                canvasHeight={layout.height}
                selected={selectedJobId === job.id}
                onSelect={() => onJobSelect(job.id)}
                formatDuration={formatDuration}
                jobAriaLabel={(name) => t("jobAriaLabel", { name })}
                viewLogsAriaLabel={(name) => t("viewLogsAriaLabel", { name })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
