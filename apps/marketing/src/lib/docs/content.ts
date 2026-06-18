import { compileMDX } from "next-mdx-remote/rsc";

import { docsMdxComponents } from "@/components/docs/mdx-components";
import { slugifyHeading } from "@/lib/legal";

import { docSources } from "../content-sources";
import { getAllDocSlugs } from "./nav-tree";
import type { DocsPageFrontmatter, DocsSection } from "./types";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function docSlugFromSourcePath(sourcePath: string): string {
  const slug = sourcePath.replace(/\.mdx$/, "");
  if (slug.length === 0) {
    throw new Error(`Unexpected docs path: ${sourcePath}`);
  }
  return slug;
}

const docSourceBySlug = new Map<string, string>(
  Object.entries(docSources).map(([sourcePath, raw]) => [docSlugFromSourcePath(sourcePath), raw]),
);

function readDocSource(slug: string): { filename: string; raw: string } {
  const raw = docSourceBySlug.get(slug);
  if (!raw) {
    throw new Error(`Doc not found: ${slug}`);
  }
  return { filename: `${slug}.mdx`, raw };
}

export function isValidDocSlug(slug: string): boolean {
  return getAllDocSlugs().includes(slug);
}

export function extractDocSections(body: string): DocsSection[] {
  const sections: DocsSection[] = [];

  for (const line of body.split("\n")) {
    const h2Match = /^## (.+)$/.exec(line.trim());
    if (h2Match?.[1]) {
      const title = h2Match[1].trim();
      sections.push({ id: slugifyHeading(title), title, level: 2 });
      continue;
    }

    const h3Match = /^### (.+)$/.exec(line.trim());
    if (h3Match?.[1]) {
      const title = h3Match[1].trim();
      sections.push({ id: slugifyHeading(title), title, level: 3 });
    }
  }

  return sections;
}

export function getDocPageMeta(slug: string): DocsPageFrontmatter {
  const { filename, raw } = readDocSource(slug);
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match?.[1]) {
    throw new Error(`Invalid docs frontmatter in ${filename}`);
  }

  const { content, frontmatter } = parseFrontmatterFromRaw(raw, filename);
  void content;

  const title = frontmatter.title;
  const description = frontmatter.description;

  if (!title || !description) {
    throw new Error(`Missing required docs frontmatter in ${filename}`);
  }

  return { title, description };
}

function parseFrontmatterFromRaw(
  raw: string,
  filename: string,
): { frontmatter: Record<string, string>; content: string } {
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid docs frontmatter in ${filename}`);
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: match[2] };
}

export async function compileDocPage(slug: string) {
  const { filename, raw } = readDocSource(slug);
  const { content, frontmatter } = await compileMDX<DocsPageFrontmatter>({
    source: raw,
    options: { parseFrontmatter: true },
    components: docsMdxComponents,
  });

  const title = frontmatter.title;
  const description = frontmatter.description;

  if (!title || !description) {
    throw new Error(`Missing required docs frontmatter in ${filename}`);
  }

  const body = raw.replace(FRONTMATTER_PATTERN, "$2");

  return {
    content,
    frontmatter: { title, description },
    sections: extractDocSections(body),
  };
}

export function getDocEditPath(slug: string): string {
  return `${slug}.mdx`;
}
