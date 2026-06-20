import type { PaginationLabels } from "@pipewatch/ui";

export function buildPaginationLabels({
  summary,
  prev,
  next,
  previousPageAriaLabel,
  nextPageAriaLabel,
  pagesAriaLabel,
  pageAriaLabel,
}: {
  summary: string;
  prev: string;
  next: string;
  previousPageAriaLabel: string;
  nextPageAriaLabel: string;
  pagesAriaLabel: string;
  pageAriaLabel: (page: number) => string;
}): PaginationLabels {
  return {
    summary,
    prev,
    next,
    previousPageAriaLabel,
    nextPageAriaLabel,
    pagesAriaLabel,
    pageAriaLabel,
  };
}

export function formatPaginationSummary({
  page,
  pageSize,
  totalItems,
  noResults,
  showing,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  noResults: string;
  showing: (values: { start: number; end: number; total: number }) => string;
}): string {
  if (totalItems === 0) {
    return noResults;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return showing({ start, end, total: totalItems });
}
