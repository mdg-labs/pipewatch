import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const CHANGELOG_DIR = join(process.cwd(), "content/changelog");

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFrontmatterValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(block: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = parseFrontmatterValue(line.slice(separator + 1));
    if (key.length > 0) {
      fields[key] = value;
    }
  }

  return fields;
}

function parseSections(body: string): ChangelogSection[] {
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

export function versionToAnchorId(version: string): string {
  const normalized = version.trim().replace(/^v/i, "");
  const slug = normalized.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? `v${slug}` : "release";
}

function parseChangelogFile(filename: string, raw: string): ChangelogEntry {
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid changelog frontmatter in ${filename}`);
  }

  const frontmatter = parseFrontmatter(match[1]);
  const version = frontmatter.version;
  const date = frontmatter.date;
  const summary = frontmatter.summary;

  if (!version || !date || !summary) {
    throw new Error(`Missing required changelog fields in ${filename}`);
  }

  const releaseUrl = frontmatter.releaseUrl?.trim();
  const entry: ChangelogEntry = {
    version,
    date,
    summary,
    anchorId: versionToAnchorId(version),
    sections: parseSections(match[2]),
  };

  if (releaseUrl && releaseUrl.length > 0) {
    entry.releaseUrl = releaseUrl;
  }

  return entry;
}

export function getChangelogEntries(): ChangelogEntry[] {
  const filenames = readdirSync(CHANGELOG_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort();

  const entries = filenames.map((filename) => {
    const raw = readFileSync(join(CHANGELOG_DIR, filename), "utf8");
    return parseChangelogFile(filename, raw);
  });

  return entries.sort((left, right) => {
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
