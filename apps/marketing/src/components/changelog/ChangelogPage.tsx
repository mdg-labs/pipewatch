import type { ChangelogEntry as ChangelogEntryData } from "@/lib/changelog";

import { ChangelogEntry } from "./ChangelogEntry";

import "./changelog.css";

type ChangelogPageProps = {
  entries: ChangelogEntryData[];
};

export function ChangelogPage({ entries }: ChangelogPageProps) {
  return (
    <div className="changelog-page">
      <header className="changelog-hero">
        <h1 className="changelog-hero-title">Changelog</h1>
        <p className="changelog-hero-body">
          Release history for PipeWatch Cloud and CE — new features, fixes, and breaking
          changes.
        </p>
      </header>

      <div className="changelog-timeline">
        {entries.map((entry) => (
          <ChangelogEntry key={`${entry.version}-${entry.date}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
