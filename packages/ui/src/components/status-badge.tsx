import type { CSSProperties } from "react";

import {
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  SkipForward,
  XCircle,
} from "lucide-react";

import { classNames } from "../lib/class-names.js";

export type PipelineStatus =
  | "success"
  | "failure"
  | "running"
  | "cancelled"
  | "skipped"
  | "queued";

export interface StatusBadgeConfig {
  label: string;
  color: string;
  bg: string;
  pulse?: boolean;
}

export const STATUS_BADGE_CONFIG: Record<PipelineStatus, StatusBadgeConfig> = {
  success: {
    label: "Succeeded",
    color: "var(--status-success)",
    bg: "var(--status-success-subtle)",
  },
  failure: {
    label: "Failed",
    color: "var(--status-failure)",
    bg: "var(--status-failure-subtle)",
  },
  running: {
    label: "Running",
    color: "var(--status-running)",
    bg: "var(--status-running-subtle)",
    pulse: true,
  },
  cancelled: {
    label: "Cancelled",
    color: "var(--status-cancelled)",
    bg: "var(--status-cancelled-subtle)",
  },
  skipped: {
    label: "Skipped",
    color: "var(--status-skipped)",
    bg: "var(--status-skipped-subtle)",
  },
  queued: {
    label: "Queued",
    color: "var(--status-queued)",
    bg: "var(--status-queued-subtle)",
  },
};

const STATUS_ICON_SIZE = 11;

function StatusIcon({ status }: { status: PipelineStatus }) {
  const iconProps = {
    size: STATUS_ICON_SIZE,
    strokeWidth: 1.5,
    "aria-hidden": true as const,
  };

  switch (status) {
    case "success":
      return <CheckCircle2 {...iconProps} />;
    case "failure":
      return <XCircle {...iconProps} />;
    case "running":
      return <Loader2 {...iconProps} className="pw-status-spin" />;
    case "cancelled":
      return <MinusCircle {...iconProps} />;
    case "skipped":
      return <SkipForward {...iconProps} />;
    case "queued":
      return <Clock {...iconProps} />;
  }
}

export interface StatusBadgeProps {
  status?: PipelineStatus;
  label?: string;
  size?: "md" | "lg";
  showDot?: boolean;
  showIcon?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function statusBadgeClassName({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string | undefined;
}): string {
  return classNames("pw-status", size === "lg" && "pw-status-lg", className);
}

export function StatusBadge({
  status = "success",
  label,
  size = "md",
  showDot = false,
  showIcon = true,
  className,
  style,
}: StatusBadgeProps) {
  const config = STATUS_BADGE_CONFIG[status];
  const displayLabel = label ?? config.label;

  return (
    <span
      className={statusBadgeClassName({ size, className })}
      style={{
        color: config.color,
        background: config.bg,
        ...style,
      }}
      role="status"
      aria-label={displayLabel}
    >
      {showDot ? (
        <span
          className={classNames(
            "pw-status-dot",
            config.pulse && "pw-status-pulse",
          )}
          style={{ background: config.color }}
          aria-hidden
        />
      ) : null}
      {showIcon ? <StatusIcon status={status} /> : null}
      {displayLabel}
    </span>
  );
}
