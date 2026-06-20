import type { ReactNode } from "react";

import { Button, Skeleton } from "@pipewatch/ui";

import type { ApiRequestError } from "../api/client.js";

type AsyncBoundaryProps = {
  loading: boolean;
  error: ApiRequestError | null;
  onRetry: () => void;
  skeleton: ReactNode;
  children: ReactNode;
};

export function AsyncBoundary({
  loading,
  error,
  onRetry,
  skeleton,
  children,
}: AsyncBoundaryProps) {
  if (loading) {
    return <>{skeleton}</>;
  }

  if (error) {
    return (
      <div className="admin-inline-error" role="alert">
        <p>{error.message}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-table-skeleton" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="line" height={36} />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="admin-stat-grid" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={88} />
      ))}
    </div>
  );
}
