export const DEFAULT_PAGE_SIZE = 20;

export type PageToken = number | "ellipsis";

export function buildPageRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PageToken[] {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  for (let offset = 1; offset <= siblingCount; offset += 1) {
    pages.add(currentPage - offset);
    pages.add(currentPage + offset);
  }

  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const range: PageToken[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    if (page === undefined) {
      continue;
    }

    const previous = sorted[index - 1];

    if (previous !== undefined && page - previous > 1) {
      range.push("ellipsis");
    }

    range.push(page);
  }

  return range;
}
