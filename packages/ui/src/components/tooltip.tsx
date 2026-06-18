import type { FocusEvent, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import { classNames } from "../lib/class-names.js";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content?: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  mono?: boolean;
  disabled?: boolean;
}

export function tooltipBoxClassName({
  position = "top",
  mono = false,
}: {
  position?: TooltipPosition;
  mono?: boolean;
}): string {
  return classNames(
    "pw-tip-box",
    `pw-tip-${position}`,
    mono && "pw-tip-mono",
  );
}

export function Tooltip({
  content,
  children,
  position = "top",
  delay = 300,
  mono = false,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (disabled || !content) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [disabled, content, delay]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setVisible(false);
  }, []);

  const handleBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      hide();
    }
  };

  return (
    <span
      className="pw-tip-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={handleBlur}
    >
      {children}
      {visible && content ? (
        <span
          className={tooltipBoxClassName({ position, mono })}
          role="tooltip"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export type { ReactNode };
