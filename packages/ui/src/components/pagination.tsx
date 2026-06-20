import type { CSSProperties } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildPageRange,
  DEFAULT_PAGE_SIZE,
  type PageToken,
} from "../lib/pagination-range.js";
import { classNames } from "../lib/class-names.js";

export { DEFAULT_PAGE_SIZE, buildPageRange };
export type { PageToken };

export interface PaginationLabels {
  summary: string;
  prev: string;
  next: string;
  previousPageAriaLabel: string;
  nextPageAriaLabel: string;
  pagesAriaLabel: string;
  pageAriaLabel: (page: number) => string;
}

export interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  labels: PaginationLabels;
  className?: string;
  style?: CSSProperties;
}

export function paginationClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-pagination", className);
}

export function Pagination({
  page,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  labels,
  className,
  style,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageRange = buildPageRange(safePage, totalPages);
  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages;

  return (
    <div className={paginationClassName({ className })} style={style}>
      <span className="pw-pagination-summary">{labels.summary}</span>
      <div className="pw-pagination-controls">
        <button
          type="button"
          className="pw-pagination-btn"
          disabled={!canGoPrev}
          onClick={() => onPageChange(safePage - 1)}
          aria-label={labels.previousPageAriaLabel}
        >
          <ChevronLeft size={12} strokeWidth={1.5} aria-hidden />
          {labels.prev}
        </button>
        <div
          className="pw-pagination-pages"
          role="group"
          aria-label={labels.pagesAriaLabel}
        >
          {pageRange.map((token, index) =>
            token === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="pw-pagination-ellipsis"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                className={classNames(
                  "pw-pagination-page",
                  token === safePage && "pw-pagination-page-active",
                )}
                onClick={() => onPageChange(token)}
                aria-current={token === safePage ? "page" : undefined}
                aria-label={labels.pageAriaLabel(token)}
              >
                {token}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className="pw-pagination-btn"
          disabled={!canGoNext}
          onClick={() => onPageChange(safePage + 1)}
          aria-label={labels.nextPageAriaLabel}
        >
          {labels.next}
          <ChevronRight size={12} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}
