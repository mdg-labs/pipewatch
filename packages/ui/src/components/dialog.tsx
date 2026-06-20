import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { trapFocus } from "../lib/focus-trap.js";
import { classNames } from "../lib/class-names.js";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  closeAriaLabel?: string;
}

export function dialogBoxClassName({
  size = "md",
  className,
}: {
  size?: DialogSize;
  className?: string | undefined;
}): string {
  return classNames("pw-dlg-box", `pw-dlg-${size}`, className);
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeAriaLabel,
}: DialogProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }

      if (boxRef.current) {
        trapFocus(boxRef.current, event);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return createPortal(
    <div
      className="pw-dlg-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={boxRef}
        className={dialogBoxClassName({ size })}
        tabIndex={-1}
      >
        <div className="pw-dlg-header">
          <div>
            <h2 id={titleId} className="pw-dlg-title">
              {title}
            </h2>
            {description ? <p className="pw-dlg-desc">{description}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              className="pw-dlg-close"
              onClick={onClose}
              aria-label={closeAriaLabel}
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="pw-dlg-body">{children}</div>
        {footer ? <div className="pw-dlg-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export type { ReactNode };
