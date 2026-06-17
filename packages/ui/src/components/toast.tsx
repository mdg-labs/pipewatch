import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

import { classNames } from "../lib/class-names.js";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  duration?: number;
}

export interface ToastItem extends Omit<ToastProps, "onDismiss"> {
  id: string;
}

export interface ToastStackProps {
  toasts?: ToastItem[];
  dismiss?: (id: string) => void;
}

const TOAST_ICONS: Record<Exclude<ToastVariant, "default">, ReactNode> = {
  success: (
    <CheckCircle2
      size={14}
      strokeWidth={1.75}
      color="var(--status-success)"
      aria-hidden
    />
  ),
  error: (
    <XCircle
      size={14}
      strokeWidth={1.75}
      color="var(--status-failure)"
      aria-hidden
    />
  ),
  warning: (
    <AlertTriangle
      size={14}
      strokeWidth={1.75}
      color="var(--pw-amber-500)"
      aria-hidden
    />
  ),
  info: (
    <Info
      size={14}
      strokeWidth={1.75}
      color="var(--status-queued)"
      aria-hidden
    />
  ),
};

export function toastClassName({
  variant = "default",
  className,
}: {
  variant?: ToastVariant;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-toast",
    variant !== "default" && `pw-toast-${variant}`,
    className,
  );
}

export function Toast({
  title,
  description,
  variant = "default",
  onDismiss,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (!duration || !onDismiss) {
      return;
    }

    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss]);

  const icon = variant !== "default" ? TOAST_ICONS[variant] : null;

  return (
    <div className={toastClassName({ variant })} role="status" aria-live="polite">
      {icon ? <span className="pw-toast-icon">{icon}</span> : null}
      <div className="pw-toast-body">
        {title ? <div className="pw-toast-title">{title}</div> : null}
        {description ? <div className="pw-toast-desc">{description}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="pw-toast-close"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X size={10} strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function ToastStack({ toasts = [], dismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="pw-toast-stack" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...(toast.title !== undefined ? { title: toast.title } : {})}
          {...(toast.description !== undefined ? { description: toast.description } : {})}
          {...(toast.variant !== undefined ? { variant: toast.variant } : {})}
          {...(toast.duration !== undefined ? { duration: toast.duration } : {})}
          onDismiss={() => dismiss?.(toast.id)}
        />
      ))}
    </div>,
    document.body,
  );
}

export type { ReactNode };
