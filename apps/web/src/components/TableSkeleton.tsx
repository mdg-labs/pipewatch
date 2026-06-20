"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@pipewatch/ui";

import "./loading-skeletons.css";

export interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 4, rows = 5 }: TableSkeletonProps) {
  const t = useTranslations("common.loading");

  return (
    <div
      className="pw-table-skeleton"
      aria-busy="true"
      aria-label={t("table")}
    >
      <div className="pw-table-skeleton-header">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={`header-${index}`} variant="line" height={12} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="pw-table-skeleton-row">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              variant="line"
              height={14}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
