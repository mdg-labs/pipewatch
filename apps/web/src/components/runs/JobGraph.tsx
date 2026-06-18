"use client";

import type { PipelineJob } from "@pipewatch/types";
import { StatusBadge, classNames } from "@pipewatch/ui";

import { formatDuration } from "@/lib/format-duration";
import {
  DAG_NODE_HEIGHT,
  DAG_NODE_WIDTH,
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

function JobGraphNode({
  job,
  layout,
  selected,
  onSelect,
}: {
  job: PipelineJob;
  layout: DagNodeLayout;
  selected: boolean;
  onSelect: () => void;
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
    <button
      type="button"
      className={classNames(
        "pw-job-graph-node",
        failed && "pw-job-graph-node-failed",
        skipped && "pw-job-graph-node-skipped",
        selected && "pw-job-graph-node-selected",
      )}
      style={{
        left: layout.x,
        top: layout.y,
        width: DAG_NODE_WIDTH,
        height: DAG_NODE_HEIGHT,
      }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${job.name} job`}
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
  );
}

export function JobGraph({ jobs, selectedJobId, onJobSelect }: JobGraphProps) {
  const layout = layoutJobDag(jobs);
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="pw-job-graph">
      <h2 className="pw-run-section-title">Job execution graph</h2>
      <div className="pw-job-graph-canvas-wrap">
        <div
          className="pw-job-graph-canvas"
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            className="pw-job-graph-edges"
            width={layout.width}
            height={layout.height}
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
                selected={selectedJobId === job.id}
                onSelect={() => onJobSelect(job.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
