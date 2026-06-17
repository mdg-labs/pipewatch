import type { CSSProperties } from "react";

import { classNames } from "../lib/class-names.js";

export type SkeletonVariant = "line" | "block" | "circle" | "rounded";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

const defaultHeightByVariant: Record<SkeletonVariant, number> = {
  line: 12,
  block: 80,
  circle: 32,
  rounded: 80,
};

const defaultWidthByVariant: Record<SkeletonVariant, number | string> = {
  line: "100%",
  block: "100%",
  circle: 32,
  rounded: "100%",
};

export function skeletonClassName({
  variant = "line",
  className,
}: {
  variant?: SkeletonVariant;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-skeleton",
    variant === "circle" && "pw-skeleton-circle",
    variant === "rounded" && "pw-skeleton-rounded",
    className,
  );
}

export function Skeleton({
  variant = "line",
  width,
  height,
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      className={skeletonClassName({ variant, className })}
      aria-hidden
      style={{
        width: width ?? defaultWidthByVariant[variant],
        height: height ?? defaultHeightByVariant[variant],
        ...style,
      }}
    />
  );
}
