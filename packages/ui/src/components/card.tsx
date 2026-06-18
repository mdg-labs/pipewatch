import type { CSSProperties, ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

export interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  interactive?: boolean;
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: () => void;
}

export function cardClassName({
  size = "md",
  interactive = false,
  className,
}: {
  size?: "sm" | "md";
  interactive?: boolean;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-card",
    size === "sm" && "pw-card-sm",
    interactive && "pw-card-interactive",
    className,
  );
}

export function Card({
  title,
  subtitle,
  actions,
  footer,
  size = "md",
  interactive = false,
  flush = false,
  className,
  style,
  children,
  onClick,
}: CardProps) {
  return (
    <div
      className={cardClassName({ size, interactive, className })}
      style={style}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {title || actions ? (
        <div className="pw-card-header">
          <div>
            {title ? <p className="pw-card-title">{title}</p> : null}
            {subtitle ? <p className="pw-card-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "pw-card-flush" : "pw-card-body"}>{children}</div>
      {footer ? <div className="pw-card-footer">{footer}</div> : null}
    </div>
  );
}
