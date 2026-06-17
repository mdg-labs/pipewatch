import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Loader2 } from "lucide-react";

import { classNames } from "../lib/class-names.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  iconOnly?: boolean;
  children?: ReactNode;
}

const spinnerSizeByButtonSize: Record<ButtonSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 18,
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-btn",
    `pw-btn-${size}`,
    `pw-btn-${variant}`,
    iconOnly && "pw-btn-icon-only",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "left",
  iconOnly = false,
  type = "button",
  className,
  style,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const spinnerSize = spinnerSizeByButtonSize[size];

  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, iconOnly, className })}
      disabled={disabled || loading}
      onClick={onClick}
      style={style}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2
          size={spinnerSize}
          strokeWidth={2.5}
          className="pw-btn-spinner"
          aria-hidden
        />
      ) : null}
      {!loading && icon && iconPosition === "left" ? icon : null}
      {children ? <span>{children}</span> : null}
      {!loading && icon && iconPosition === "right" ? icon : null}
    </button>
  );
}
