"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DocsSearchEntry } from "@/lib/docs/types";

type DocsSearchProps = {
  entries: DocsSearchEntry[];
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function DocsSearch({ entries }: DocsSearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalized = normalizeQuery(query);
    if (normalized.length === 0) {
      return [];
    }

    return entries.filter((entry) => {
      const haystack = `${entry.title} ${entry.description} ${entry.section}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [entries, query]);

  return (
    <div className="docs-search">
      <label className="docs-search-label" htmlFor="docs-search-input">
        Search docs
      </label>
      <input
        id="docs-search-input"
        type="search"
        className="docs-search-input"
        placeholder="Search documentation…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />

      {query.trim().length > 0 ? (
        <div className="docs-search-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <p className="docs-search-empty">No matching pages.</p>
          ) : (
            <ul className="docs-search-list">
              {results.map((entry) => (
                <li key={entry.href}>
                  <Link href={entry.href} className="docs-search-result">
                    <span className="docs-search-result-title">{entry.title}</span>
                    <span className="docs-search-result-meta">{entry.section}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
