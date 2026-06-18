import { getDocPageMeta } from "./content";
import { docsNavTree } from "./nav-tree";
import type { DocsSearchEntry } from "./types";

export function buildDocsSearchIndex(): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = [];

  for (const section of docsNavTree) {
    for (const item of section.items) {
      if (!item.slug) {
        continue;
      }

      const { title, description } = getDocPageMeta(item.slug);
      entries.push({
        title,
        description,
        href: `/docs/${item.slug}`,
        section: section.title,
      });
    }
  }

  return entries;
}
