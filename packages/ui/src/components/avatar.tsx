import type { CSSProperties } from "react";

import { classNames } from "../lib/class-names.js";

export type AvatarSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  rounded?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function toInitials(name = ""): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function avatarClassName({
  size = "md",
  rounded = false,
  className,
}: {
  size?: AvatarSize;
  rounded?: boolean;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-avatar",
    `pw-avatar-${size}`,
    rounded && "pw-avatar-rounded",
    className,
  );
}

export function Avatar({
  src,
  name = "",
  size = "md",
  rounded = false,
  className,
  style,
}: AvatarProps) {
  return (
    <span
      className={avatarClassName({ size, rounded, className })}
      style={style}
      title={name || undefined}
      aria-label={name || "Avatar"}
      role="img"
    >
      {src ? <img src={src} alt={name || "Avatar"} /> : toInitials(name)}
    </span>
  );
}
