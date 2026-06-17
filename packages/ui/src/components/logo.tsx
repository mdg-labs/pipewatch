import type { CSSProperties, SVGProps } from "react";

import { classNames } from "../lib/class-names.js";

export interface LogoProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function logoClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-logo", className);
}

/** PipeWatch mark — 32×32 waveform-in-circle, inherits color via currentColor. */
export function Logo({
  size = 32,
  className,
  style,
  title,
  ...svgProps
}: LogoProps) {
  return (
    <svg
      {...svgProps}
      className={logoClassName({ className })}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5.5 16h4l2-5.5 2 11 2-11 2 11 2-5.5h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
