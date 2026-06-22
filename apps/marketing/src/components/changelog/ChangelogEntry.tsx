import type { ChangelogEntry as ChangelogEntryData } from "@/lib/changelog";
import { formatChangelogDate } from "@/lib/changelog";

type ChangelogEntryProps = {
  entry: ChangelogEntryData;
};

export function ChangelogEntry({ entry }: ChangelogEntryProps) {
  return (
    <article id={entry.anchorId} className="changelog-entry">
      <header className="changelog-entry-header">
        <div className="changelog-entry-heading">
          <h2 className="changelog-entry-version">
            <a href={`#${entry.anchorId}`} className="changelog-version-link">
              {entry.version}
            </a>
          </h2>
          <time className="changelog-entry-date" dateTime={entry.date}>
            {formatChangelogDate(entry.date)}
          </time>
        </div>
        {entry.releaseUrl ? (
          <a
            href={entry.releaseUrl}
            className="changelog-release-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Full release
          </a>
        ) : null}
      </header>

      <p className="changelog-entry-summary">{entry.summary}</p>

      {entry.sections.map((section) => (
        <section key={section.title} className="changelog-section">
          <h3 className="changelog-section-title">{section.title}</h3>
          <ul className="changelog-section-list">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
