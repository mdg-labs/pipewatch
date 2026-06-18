import type { LegalPageSlug } from "@/lib/legal";
import { compileLegalPage, formatLegalDate } from "@/lib/legal";

import "./legal.css";

type LegalPageProps = {
  slug: LegalPageSlug;
};

export async function LegalPage({ slug }: LegalPageProps) {
  const { content, frontmatter, sections } = await compileLegalPage(slug);

  return (
    <div className="legal-page">
      <header className="legal-hero">
        <h1 className="legal-hero-title">{frontmatter.title}</h1>
        <p className="legal-hero-description">{frontmatter.description}</p>
        <p className="legal-last-updated">
          Last updated{" "}
          <time dateTime={frontmatter.lastUpdated}>{formatLegalDate(frontmatter.lastUpdated)}</time>
        </p>
      </header>

      {sections.length > 0 ? (
        <nav className="legal-toc" aria-label="On this page">
          <p className="legal-toc-label">On this page</p>
          <ol className="legal-toc-list">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="legal-toc-link">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <article className="legal-prose">{content}</article>
    </div>
  );
}
