import type { CSSProperties } from "react";

import { classNames } from "../lib/class-names.js";

export interface RunPulseProps {
  size?: number;
  label?: string;
  ring?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function runPulseDotClassName({
  ring = false,
}: {
  ring?: boolean;
}): string {
  return classNames("pw-pulse-dot", ring && "pw-pulse-ring");
}

export function RunPulse({
  size = 8,
  label,
  ring = false,
  className,
  style,
}: RunPulseProps) {
  const ariaLabel = label ?? "Running";

  return (
    <span
      className={classNames("pw-pulse-wrap", className)}
      style={style}
      role="status"
      aria-label={ariaLabel}
    >
      <span
        className={runPulseDotClassName({ ring })}
        style={{ width: size, height: size }}
        aria-hidden
      />
      {label ? <span className="pw-pulse-label">{label}</span> : null}
    </span>
  );
}
