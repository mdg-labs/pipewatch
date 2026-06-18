export type DocsPageFrontmatter = {
  title: string;
  description: string;
};

export type DocsSection = {
  id: string;
  title: string;
  level: 2 | 3;
};

export type DocsNavLeaf = {
  title: string;
  slug?: string;
  externalHref?: string;
};

export type DocsNavSection = {
  title: string;
  items: DocsNavLeaf[];
};

export type DocsSearchEntry = {
  title: string;
  description: string;
  href: string;
  section: string;
};
