import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

import { classNames } from "../lib/class-names.js";
import { Sparkline } from "./sparkline.js";
import {
  StatusBadge,
  type PipelineStatus,
} from "./status-badge.js";

export interface RepoCardProps {
  name: string;
  org?: string;
  branch?: string;
  status?: PipelineStatus;
  lastRunTime?: string;
  duration?: string;
  /** Convenience prop — renders a Sparkline when length > 1. */
  trend?: number[];
  /** Optional sparkline slot — overrides `trend` when provided. */
  sparkline?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function repoCardClassName({
  className,
}: {
  className?: string | undefined;
}): string {
  return classNames("pw-repo-card", className);
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  onClick?: () => void,
): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onClick?.();
  }
}

export function RepoCard({
  name,
  org,
  branch,
  status = "success",
  lastRunTime,
  duration,
  trend = [],
  sparkline,
  onClick,
  className,
  style,
}: RepoCardProps) {
  const trendColor =
    status === "failure" ? "var(--status-failure)" : "var(--status-success)";

  const sparklineContent =
    sparkline ??
    (trend.length > 1 ? (
      <Sparkline
        data={trend}
        width={80}
        height={20}
        color={trendColor}
        strokeWidth={1.5}
        showArea
      />
    ) : null);

  return (
    <div
      className={repoCardClassName({ className })}
      style={style}
      onClick={onClick}
      onKeyDown={(event) => handleCardKeyDown(event, onClick)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="pw-repo-card-head">
        <div>
          {org ? <div className="pw-repo-card-org">{org}/</div> : null}
          <div className="pw-repo-card-name">{name}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      {branch || lastRunTime ? (
        <div className="pw-repo-card-meta">
          {branch ? <span className="pw-repo-card-branch">{branch}</span> : null}
          {lastRunTime ? (
            <span className="pw-repo-card-time">{lastRunTime}</span>
          ) : null}
        </div>
      ) : null}

      <div className="pw-repo-card-foot">
        <span className="pw-repo-card-dur">{duration ?? "—"}</span>
        {sparklineContent}
      </div>
    </div>
  );
}
