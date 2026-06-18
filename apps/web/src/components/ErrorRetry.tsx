"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@pipewatch/ui";

import "./error-retry.css";

export interface ErrorRetryProps {
  title?: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function ErrorRetry({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
}: ErrorRetryProps) {
  return (
    <div className="pw-error-retry" role="alert">
      <div className="pw-error-retry-icon" aria-hidden>
        <AlertTriangle size={18} strokeWidth={1.75} />
      </div>
      <div className="pw-error-retry-body">
        <p className="pw-error-retry-title">{title}</p>
        <p className="pw-error-retry-message">{message}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
