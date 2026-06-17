"use client";

import { classNames } from "@pipewatch/ui";

export type LiveConnectionStatus = "connected" | "reconnecting" | "offline";

export type LiveIndicatorProps = {
  status?: LiveConnectionStatus;
};

const STATUS_LABELS: Record<LiveConnectionStatus, string> = {
  connected: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export function LiveIndicator({ status = "offline" }: LiveIndicatorProps) {
  return (
    <span
      className={classNames(
        "pw-app-live-indicator",
        `pw-app-live-indicator-${status}`,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="pw-app-live-dot" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
