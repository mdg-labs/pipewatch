import type { CSSProperties, ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

export const DEFAULT_USAGE_WARNING_THRESHOLD = 0.8;

export type UsageMeterTone = "default" | "warning" | "critical";

export interface UsageMeterProps {
  label: ReactNode;
  used: number;
  limit: number | null;
  warningThreshold?: number;
  suffix?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function usageMeterClassName({
  tone = "default",
  className,
}: {
  tone?: UsageMeterTone;
  className?: string | undefined;
} = {}): string {
  return classNames("pw-usage-meter", `pw-usage-meter-${tone}`, className);
}

function resolveUsageTone(
  ratio: number | null,
  warningThreshold: number,
): UsageMeterTone {
  if (ratio === null) {
    return "default";
  }

  if (ratio >= 1) {
    return "critical";
  }

  if (ratio >= warningThreshold) {
    return "warning";
  }

  return "default";
}

export function formatUsageLabel(used: number, limit: number | null): string {
  if (limit === null) {
    return `${used}`;
  }

  return `${used} / ${limit}`;
}

export function UsageMeter({
  label,
  used,
  limit,
  warningThreshold = DEFAULT_USAGE_WARNING_THRESHOLD,
  suffix,
  className,
  style,
}: UsageMeterProps) {
  const ratio =
    limit === null || limit <= 0 ? null : Math.min(used / limit, 1);
  const percent = ratio === null ? 0 : ratio * 100;
  const tone = resolveUsageTone(ratio, warningThreshold);

  return (
    <div className={usageMeterClassName({ tone, className })} style={style}>
      <span className="pw-usage-meter-label">{label}</span>
      {limit === null ? (
        <div className="pw-usage-meter-static">
          {suffix ?? (
            <span className="pw-usage-meter-value">{formatUsageLabel(used, limit)}</span>
          )}
        </div>
      ) : (
        <>
          <div
            className="pw-usage-meter-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={used}
            aria-label={typeof label === "string" ? label : undefined}
          >
            <div
              className="pw-usage-meter-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="pw-usage-meter-value">
            {formatUsageLabel(used, limit)}
          </span>
        </>
      )}
    </div>
  );
}
