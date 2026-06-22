import type { CollectionEntry } from "astro:content";

export type ChangelogSection = {
  title: string;
  items: string[];
};

export type ChangelogEntry = {
  version: string;
  date: string;
  summary: string;
  releaseUrl?: string;
  anchorId: string;
  sections: ChangelogSection[];
};

export function versionToAnchorId(version: string): string {
  const normalized = version.trim().replace(/^v/i, "");
  const slug = normalized.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? `v${slug}` : "release";
}

export function parseSections(body: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  const parts = body.trim().split(/\n(?=## )/);

  for (const part of parts) {
    const lines = part.trim().split("\n");
    const heading = lines[0];
    if (!heading?.startsWith("## ")) {
      continue;
    }

    const title = heading.slice(3).trim();
    const items = lines
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())
      .filter((line) => line.length > 0);

    if (items.length > 0) {
      sections.push({ title, items });
    }
  }

  return sections;
}

export function toChangelogEntries(entries: CollectionEntry<"changelog">[]): ChangelogEntry[] {
  return entries
    .map((entry) => {
      const mapped: ChangelogEntry = {
        version: entry.data.version,
        date: entry.data.date,
        summary: entry.data.summary,
        anchorId: versionToAnchorId(entry.data.version),
        sections: parseSections(entry.body ?? ""),
      };

      if (entry.data.releaseUrl) {
        mapped.releaseUrl = entry.data.releaseUrl;
      }

      return mapped;
    })
    .sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return right.version.localeCompare(left.version, undefined, { numeric: true });
    });
}

export function formatChangelogDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
