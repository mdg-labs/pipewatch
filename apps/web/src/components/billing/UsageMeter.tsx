"use client";

import {
  UsageMeter as UiUsageMeter,
  type UsageMeterProps as UiUsageMeterProps,
} from "@pipewatch/ui";

export type UsageMeterProps = UiUsageMeterProps;

/** Billing usage row — wraps the shared progress meter (B12). */
export function UsageMeter(props: UsageMeterProps) {
  return <UiUsageMeter {...props} />;
}

export type RetentionUsageRowProps = {
  retentionDays: number;
  maxRetentionDays: number;
  planLabel: string;
};

/** Retention setting row — no progress bar; shows configured days vs plan max (B12). */
export function RetentionUsageRow({
  retentionDays,
  maxRetentionDays,
  planLabel,
}: RetentionUsageRowProps) {
  return (
    <UiUsageMeter
      label="Run history retention"
      used={retentionDays}
      limit={null}
      suffix={
        <>
          <span className="pw-usage-meter-value">{retentionDays} days</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            ({planLabel} plan maximum: {maxRetentionDays} days)
          </span>
        </>
      }
    />
  );
}
