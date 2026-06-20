import type { CSSProperties, ReactNode } from "react";

import { classNames } from "../lib/class-names.js";

export interface DangerZoneProps {
  title: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export interface DangerZoneItemProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function dangerZoneClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-danger-zone", className);
}

export function DangerZone({
  title,
  children,
  className,
  style,
  id,
}: DangerZoneProps) {
  return (
    <section
      id={id}
      className={dangerZoneClassName({ className })}
      style={style}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <h2 id={id ? `${id}-title` : undefined} className="pw-danger-zone-title">
        {title}
      </h2>
      <div className="pw-danger-zone-body">{children}</div>
    </section>
  );
}

export function DangerZoneItem({
  title,
  description,
  action,
}: DangerZoneItemProps) {
  return (
    <div className="pw-danger-zone-item">
      <div className="pw-danger-zone-item-copy">
        <div className="pw-danger-zone-item-title">{title}</div>
        {description ? (
          <div className="pw-danger-zone-item-desc">{description}</div>
        ) : null}
      </div>
      {action ? <div className="pw-danger-zone-item-action">{action}</div> : null}
    </div>
  );
}
