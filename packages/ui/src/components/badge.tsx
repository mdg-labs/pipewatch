import type { HTMLAttributes, ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

export type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "failure"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  mono?: boolean;
  pill?: boolean;
  size?: "lg";
  children?: ReactNode;
}

export function badgeClassName({
  variant = "default",
  mono = false,
  pill = false,
  size,
  className,
}: {
  variant?: BadgeVariant;
  mono?: boolean;
  pill?: boolean;
  size?: "lg" | undefined;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-badge",
    `pw-badge-${variant}`,
    mono && "pw-badge-mono",
    pill && "pw-badge-pill",
    size === "lg" && "pw-badge-lg",
    className,
  );
}

export function Badge({
  variant = "default",
  mono = false,
  pill = false,
  size,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={badgeClassName({ variant, mono, pill, size, className })} {...rest}>
      {children}
    </span>
  );
}
