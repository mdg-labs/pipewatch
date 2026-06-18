"use client";

import type { PipelineRun } from "@pipewatch/types";
import { RunPulse } from "@pipewatch/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatElapsedSince } from "@/lib/dashboard-utils";
import { formatBranchDisplay, formatPipelineNameDisplay } from "@/lib/run-utils";

import "./repo-detail.css";

export type ActiveRunBannerProps = {
  runs: PipelineRun[];
  workspaceSlug: string;
  repoId: string;
};

export function ActiveRunBanner({ runs, workspaceSlug, repoId }: ActiveRunBannerProps) {
  const activeRun = runs.find((run) => run.status === "in_progress" || run.status === "queued");

  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRun) {
      setElapsed(null);
      return;
    }

    const tick = () => {
      setElapsed(formatElapsedSince(activeRun.started_at));
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeRun]);

  if (!activeRun) {
    return null;
  }

  const activeCount = runs.filter(
    (run) => run.status === "in_progress" || run.status === "queued",
  ).length;

  const detailHref = `/workspaces/${workspaceSlug}/repos/${repoId}/runs/${activeRun.id}`;

  return (
    <div className="pw-active-run-banner" role="status" aria-live="polite">
      <RunPulse size={7} ring />
      <span className="pw-active-run-banner-copy">
        {activeCount} run{activeCount === 1 ? "" : "s"} in progress
      </span>
      <span className="pw-active-run-banner-meta" aria-hidden>
        ·
      </span>
      <span className="pw-active-run-banner-meta">
        {formatPipelineNameDisplay(activeRun.pipeline_name)}
      </span>
      <span className="pw-active-run-banner-branch">{formatBranchDisplay(activeRun.branch)}</span>
      {elapsed ? (
        <>
          <span className="pw-active-run-banner-meta" aria-hidden>
            ·
          </span>
          <span className="pw-active-run-banner-elapsed">{elapsed} elapsed</span>
        </>
      ) : null}
      <Link href={detailHref} className="pw-active-run-banner-link">
        View →
      </Link>
    </div>
  );
}
