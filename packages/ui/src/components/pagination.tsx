import type { CSSProperties } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildPageRange,
  DEFAULT_PAGE_SIZE,
  paginationSummary,
  type PageToken,
} from "../lib/pagination-range.js";
import { classNames } from "../lib/class-names.js";

export { DEFAULT_PAGE_SIZE, buildPageRange, paginationSummary };
export type { PageToken };

export interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
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
      <span className="pw-pagination-summary">
        {paginationSummary({ page: safePage, pageSize, totalItems })}
      </span>
      <div className="pw-pagination-controls">
        <button
          type="button"
          className="pw-pagination-btn"
          disabled={!canGoPrev}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={12} strokeWidth={1.5} aria-hidden />
          Prev
        </button>
        <div className="pw-pagination-pages" role="group" aria-label="Pages">
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
                aria-label={`Page ${token}`}
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
          aria-label="Next page"
        >
          Next
          <ChevronRight size={12} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}
