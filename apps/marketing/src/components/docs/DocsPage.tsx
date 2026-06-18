import { compileDocPage, getDocEditPath } from "@/lib/docs/content";

import { DocsLayout } from "./DocsLayout";

type DocsPageProps = {
  slug: string;
};

export async function DocsPage({ slug }: DocsPageProps) {
  const { content, frontmatter, sections } = await compileDocPage(slug);

  return (
    <DocsLayout slug={slug} editPath={getDocEditPath(slug)} sections={sections}>
      <header className="docs-page-header">
        <h1 className="docs-page-title">{frontmatter.title}</h1>
        <p className="docs-page-description">{frontmatter.description}</p>
      </header>
      <div className="docs-prose">{content}</div>
    </DocsLayout>
  );
}
