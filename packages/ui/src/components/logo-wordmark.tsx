import type { CSSProperties } from "react";

import { classNames } from "../lib/class-names.js";

import { Logo } from "./logo.js";

export interface LogoWordmarkProps {
  markSize?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function logoWordmarkClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-logo-wordmark", className);
}

/** PipeWatch mark + logotype — mark uses amber, "Watch" uses accent color. */
export function LogoWordmark({
  markSize = 20,
  className,
  style,
  title = "PipeWatch",
}: LogoWordmarkProps) {
  return (
    <span
      className={logoWordmarkClassName({ className })}
      style={style}
      role="img"
      aria-label={title}
    >
      <Logo size={markSize} aria-hidden />
      <span className="pw-logo-wordmark-text" aria-hidden>
        Pipe<span className="pw-logo-wordmark-accent">Watch</span>
      </span>
    </span>
  );
}
