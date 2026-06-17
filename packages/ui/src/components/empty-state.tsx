import type { ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function emptyStateClassName({
  className,
}: {
  className?: string | undefined;
}): string {
  return classNames("pw-empty", className);
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div className={emptyStateClassName({ className })}>
      {icon ? <div className="pw-empty-icon">{icon}</div> : null}
      {title ? <p className="pw-empty-title">{title}</p> : null}
      {description ? <p className="pw-empty-desc">{description}</p> : null}
      {actions ? <div className="pw-empty-actions">{actions}</div> : null}
    </div>
  );
}

export type { ReactNode };
