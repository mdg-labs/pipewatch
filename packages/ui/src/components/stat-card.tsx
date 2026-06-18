import type { CSSProperties, ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  trend?: ReactNode;
  mono?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function statCardClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-stat-card", className);
}

export function StatCard({
  label,
  value,
  trend,
  mono = false,
  className,
  style,
}: StatCardProps) {
  return (
    <div className={statCardClassName({ className })} style={style}>
      <div className="pw-stat-card-label">{label}</div>
      <div
        className={classNames(
          "pw-stat-card-value",
          mono && "pw-stat-card-value-mono",
        )}
      >
        {value}
      </div>
      {trend ? <div className="pw-stat-card-trend">{trend}</div> : null}
    </div>
  );
}
