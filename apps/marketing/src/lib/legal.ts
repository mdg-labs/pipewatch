import { readFileSync } from "node:fs";
import { join } from "node:path";

import { compileMDX } from "next-mdx-remote/rsc";

import { legalMdxComponents } from "@/components/legal/mdx-components";

export type LegalPageSlug = "privacy" | "terms";

export type LegalPageFrontmatter = {
  title: string;
  description: string;
  lastUpdated: string;
};

export type LegalSection = {
  id: string;
  title: string;
};

const LEGAL_DIR = join(process.cwd(), "content/legal");

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

function parseFrontmatterBlock(block: string): Record<string, string> {
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

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "section";
}

function splitLegalSource(raw: string, filename: string): { frontmatter: Record<string, string>; body: string } {
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid legal frontmatter in ${filename}`);
  }

  return {
    frontmatter: parseFrontmatterBlock(match[1]),
    body: match[2],
  };
}

export function extractLegalSections(body: string): LegalSection[] {
  const sections: LegalSection[] = [];

  for (const line of body.split("\n")) {
    const match = /^## (.+)$/.exec(line.trim());
    if (!match?.[1]) {
      continue;
    }

    const title = match[1].trim();
    sections.push({
      id: slugifyHeading(title),
      title,
    });
  }

  return sections;
}

function readLegalSource(slug: LegalPageSlug): { filename: string; raw: string } {
  const filename = `${slug}.mdx`;
  const raw = readFileSync(join(LEGAL_DIR, filename), "utf8");
  return { filename, raw };
}

export function getLegalPageMeta(slug: LegalPageSlug): LegalPageFrontmatter {
  const { filename, raw } = readLegalSource(slug);
  const { frontmatter } = splitLegalSource(raw, filename);

  const title = frontmatter.title;
  const description = frontmatter.description;
  const lastUpdated = frontmatter.lastUpdated;

  if (!title || !description || !lastUpdated) {
    throw new Error(`Missing required legal frontmatter in ${filename}`);
  }

  return { title, description, lastUpdated };
}

export function getLegalSections(slug: LegalPageSlug): LegalSection[] {
  const { filename, raw } = readLegalSource(slug);
  const { body } = splitLegalSource(raw, filename);
  return extractLegalSections(body);
}

export async function compileLegalPage(slug: LegalPageSlug) {
  const { filename, raw } = readLegalSource(slug);
  const { content, frontmatter } = await compileMDX<LegalPageFrontmatter>({
    source: raw,
    options: { parseFrontmatter: true },
    components: legalMdxComponents,
  });

  const title = frontmatter.title;
  const description = frontmatter.description;
  const lastUpdated = frontmatter.lastUpdated;

  if (!title || !description || !lastUpdated) {
    throw new Error(`Missing required legal frontmatter in ${filename}`);
  }

  return {
    content,
    frontmatter: { title, description, lastUpdated },
    sections: extractLegalSections(raw.replace(FRONTMATTER_PATTERN, "$2")),
  };
}

export function formatLegalDate(isoDate: string): string {
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
