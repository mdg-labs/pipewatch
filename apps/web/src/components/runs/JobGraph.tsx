"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PipelineJob } from "@pipewatch/types";
import { StatusBadge, classNames } from "@pipewatch/ui";
import { ExternalLink, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTimeFormatters } from "@/i18n/use-time-formatters";
import {
  JOB_GRAPH_VIEWPORT_HEIGHT,
  computeFitTransform,
  computeResetTransform,
  stepZoom,
  zoomAtPoint,
  type ViewportTransform,
} from "@/lib/job-graph-viewport";
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

function scrollToJobPanel(jobId: string): void {
  const panel = document.getElementById(`job-panel-${jobId}`);
  panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function isPanExcludedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      ".pw-job-graph-node, .pw-job-graph-node-log-link, .pw-job-graph-controls button",
    ),
  );
}

function JobGraphNode({
  job,
  layout,
  nodeWidth,
  nodeHeight,
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
        left: layout.x,
        top: layout.y,
        width: nodeWidth,
        height: nodeHeight,
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
        <StatusBadge
          status={badgeStatus}
          label=""
          className="pw-job-graph-node-status"
          aria-label={job.name}
        />
        <span className="pw-job-graph-node-name">{job.name}</span>
        <span className="pw-job-graph-node-duration">{durationLabel}</span>
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: JOB_GRAPH_VIEWPORT_HEIGHT });
  const [transform, setTransform] = useState<ViewportTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const layout = layoutJobDag(jobs);
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const applyFit = useCallback(() => {
    const element = viewportRef.current;
    if (!element || layout.width <= 0 || layout.height <= 0) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setTransform(
      computeFitTransform(rect.width, rect.height, layout.width, layout.height),
    );
  }, [layout.width, layout.height]);

  const applyReset = useCallback(() => {
    const element = viewportRef.current;
    if (!element || layout.width <= 0 || layout.height <= 0) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setTransform(
      computeResetTransform(rect.width, rect.height, layout.width, layout.height),
    );
  }, [layout.width, layout.height]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(element);
    const rect = element.getBoundingClientRect();
    setViewportSize({ width: rect.width, height: rect.height });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (viewportSize.width <= 0 || layout.width <= 0) {
      return;
    }

    setTransform(
      computeFitTransform(
        viewportSize.width,
        viewportSize.height,
        layout.width,
        layout.height,
      ),
    );
  }, [layout.width, layout.height, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pan = panStateRef.current;
      if (!pan || pan.pointerId !== event.pointerId) {
        return;
      }

      setTransform((current) => ({
        ...current,
        translateX: pan.originX + (event.clientX - pan.startX),
        translateY: pan.originY + (event.clientY - pan.startY),
      }));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const pan = panStateRef.current;
      if (!pan || pan.pointerId !== event.pointerId) {
        return;
      }

      panStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

    setTransform((current) =>
      zoomAtPoint(current, current.scale * zoomFactor, pointerX, pointerY),
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isPanExcludedTarget(event.target)) {
      return;
    }

    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.translateX,
      originY: transform.translateY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleZoomIn = () => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setTransform((current) =>
      zoomAtPoint(current, stepZoom(current.scale, "in"), centerX, centerY),
    );
  };

  const handleZoomOut = () => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setTransform((current) =>
      zoomAtPoint(current, stepZoom(current.scale, "out"), centerX, centerY),
    );
  };

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="pw-job-graph">
      <h2 className="pw-run-section-title">{t("title")}</h2>
      <div className="pw-job-graph-canvas-wrap">
        <div className="pw-job-graph-controls" role="toolbar" aria-label={t("controlsAriaLabel")}>
          <button
            type="button"
            className="pw-job-graph-control"
            onClick={handleZoomIn}
            aria-label={t("zoomInAriaLabel")}
          >
            <Plus size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="pw-job-graph-control"
            onClick={handleZoomOut}
            aria-label={t("zoomOutAriaLabel")}
          >
            <Minus size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="pw-job-graph-control"
            onClick={applyFit}
            aria-label={t("fitToViewAriaLabel")}
          >
            <Maximize2 size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="pw-job-graph-control"
            onClick={applyReset}
            aria-label={t("resetZoomAriaLabel")}
          >
            <RotateCcw size={14} aria-hidden />
          </button>
        </div>
        <div
          ref={viewportRef}
          className="pw-job-graph-viewport"
          style={{ height: JOB_GRAPH_VIEWPORT_HEIGHT }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
        >
          <div
            className="pw-job-graph-transform"
            style={{
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
            }}
          >
            <div
              className="pw-job-graph-canvas"
              style={{ width: layout.width, height: layout.height }}
            >
              <svg
                className="pw-job-graph-edges"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                width={layout.width}
                height={layout.height}
                aria-hidden
              >
                {layout.edges.map((edge) => {
                  const toJob = jobById.get(edge.toJobId);
                  const dashed = toJob
                    ? mapPipelineJobToBadgeStatus(toJob) === "skipped"
                    : false;

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
                      markerEnd={
                        dashed ? "url(#pw-dag-arrow-skipped)" : "url(#pw-dag-arrow)"
                      }
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
      </div>
    </div>
  );
}
