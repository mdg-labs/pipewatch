import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo } from "react";

import {
  filtersToSearchParams,
  mergeFilterState,
  parseFiltersFromSearchParams,
  type FilterFieldConfig,
  type FilterState,
} from "../lib/filter-bar-url.js";
import { classNames } from "../lib/class-names.js";

export {
  filtersToSearchParams,
  mergeFilterState,
  parseFiltersFromSearchParams,
  filterSearchString,
  type FilterFieldConfig,
  type FilterState,
  type FilterValue,
} from "../lib/filter-bar-url.js";

export type FilterChipTone =
  | "default"
  | "accent"
  | "success"
  | "failure"
  | "running"
  | "cancelled";

export interface FilterBarProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface FilterChipProps {
  label: ReactNode;
  active?: boolean;
  count?: number;
  tone?: FilterChipTone;
  onClick?: () => void;
  className?: string;
}

export interface FilterBarInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function filterBarClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-filter-bar", className);
}

export function filterChipClassName({
  active = false,
  tone = "default",
  className,
}: {
  active?: boolean;
  tone?: FilterChipTone;
  className?: string | undefined;
} = {}): string {
  return classNames(
    "pw-filter-chip",
    active && "pw-filter-chip-active",
    `pw-filter-chip-${tone}`,
    className,
  );
}

export function FilterBar({ children, className, style }: FilterBarProps) {
  return (
    <div className={filterBarClassName({ className })} style={style}>
      {children}
    </div>
  );
}

export function FilterChip({
  label,
  active = false,
  count,
  tone = "default",
  onClick,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={filterChipClassName({ active, tone, className })}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span className="pw-filter-chip-count">{count}</span>
      ) : null}
    </button>
  );
}

export function FilterBarInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: FilterBarInputProps) {
  return (
    <label className={classNames("pw-filter-bar-input", className)}>
      {label ? <span className="pw-filter-bar-input-label">{label}</span> : null}
      <input
        type="search"
        className="pw-filter-bar-input-field"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export interface UseFilterBarOptions {
  fields: FilterFieldConfig[];
  searchParams: URLSearchParams;
  onSearchParamsChange: (params: URLSearchParams) => void;
}

export interface UseFilterBarResult {
  filters: FilterState;
  setFilter: (key: string, value: FilterState[string]) => void;
  setFilters: (patch: FilterState) => void;
  clearFilters: () => void;
}

export function useFilterBar({
  fields,
  searchParams,
  onSearchParamsChange,
}: UseFilterBarOptions): UseFilterBarResult {
  const filters = useMemo(
    () => parseFiltersFromSearchParams(searchParams, fields),
    [fields, searchParams],
  );

  const commitFilters = useCallback(
    (next: FilterState) => {
      onSearchParamsChange(filtersToSearchParams(next, fields));
    },
    [fields, onSearchParamsChange],
  );

  const setFilter = useCallback(
    (key: string, value: FilterState[string]) => {
      commitFilters(mergeFilterState(filters, { [key]: value }));
    },
    [commitFilters, filters],
  );

  const setFilters = useCallback(
    (patch: FilterState) => {
      commitFilters(mergeFilterState(filters, patch));
    },
    [commitFilters, filters],
  );

  const clearFilters = useCallback(() => {
    const cleared: FilterState = {};

    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        cleared[field.key] = field.defaultValue;
      }
    }

    commitFilters(cleared);
  }, [commitFilters, fields]);

  return {
    filters,
    setFilter,
    setFilters,
    clearFilters,
  };
}
