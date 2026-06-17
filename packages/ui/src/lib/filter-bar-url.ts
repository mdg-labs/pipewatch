export type FilterValue = string | string[] | undefined;

export type FilterState = Record<string, FilterValue>;

export interface FilterFieldConfig {
  key: string;
  defaultValue?: string;
  multi?: boolean;
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

export function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
  fields: FilterFieldConfig[],
): FilterState {
  const state: FilterState = {};

  for (const field of fields) {
    if (field.multi) {
      const values = searchParams
        .getAll(field.key)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      state[field.key] = values.length > 0 ? values : undefined;
      continue;
    }

    const value = searchParams.get(field.key)?.trim();

    if (isNonEmpty(value)) {
      state[field.key] = value;
      continue;
    }

    if (field.defaultValue !== undefined) {
      state[field.key] = field.defaultValue;
    }
  }

  return state;
}

export function filtersToSearchParams(
  filters: FilterState,
  fields: FilterFieldConfig[],
): URLSearchParams {
  const params = new URLSearchParams();

  for (const field of fields) {
    const value = filters[field.key];

    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry.length > 0) {
          params.append(field.key, entry);
        }
      }
      continue;
    }

    if (value.length === 0) {
      continue;
    }

    if (field.defaultValue !== undefined && value === field.defaultValue) {
      continue;
    }

    params.set(field.key, value);
  }

  return params;
}

export function mergeFilterState(
  current: FilterState,
  patch: FilterState,
): FilterState {
  return { ...current, ...patch };
}

export function filterSearchString(
  filters: FilterState,
  fields: FilterFieldConfig[],
): string {
  const params = filtersToSearchParams(filters, fields);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}
