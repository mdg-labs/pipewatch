"use client";

import { useTranslations } from "next-intl";

import { classNames } from "@pipewatch/ui";

export type LiveConnectionStatus = "connected" | "connecting" | "reconnecting" | "offline";

export type LiveIndicatorProps = {
  status?: LiveConnectionStatus;
};

export function LiveIndicator({ status = "offline" }: LiveIndicatorProps) {
  const t = useTranslations("app.liveIndicator");

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
      {t(status)}
    </span>
  );
}
