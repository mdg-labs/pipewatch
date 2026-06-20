"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@pipewatch/ui";

import "./error-retry.css";

export interface ErrorRetryProps {
  title?: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function ErrorRetry({
  title,
  message,
  onRetry,
  retryLabel,
}: ErrorRetryProps) {
  const t = useTranslations("common.error");

  return (
    <div className="pw-error-retry" role="alert">
      <div className="pw-error-retry-icon" aria-hidden>
        <AlertTriangle size={18} strokeWidth={1.75} />
      </div>
      <div className="pw-error-retry-body">
        <p className="pw-error-retry-title">{title ?? t("title")}</p>
        <p className="pw-error-retry-message">{message}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {retryLabel ?? t("retry")}
      </Button>
    </div>
  );
}
