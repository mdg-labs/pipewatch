import type { ReactNode } from "react";

import { DocsBreadcrumb } from "@/components/docs/DocsBreadcrumb";
import { DocsEditLink } from "@/components/docs/DocsEditLink";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsToc } from "@/components/docs/DocsToc";
import { getBreadcrumbTrail, docsNavTree } from "@/lib/docs/nav-tree";
import { buildDocsSearchIndex } from "@/lib/docs/search-index";
import type { DocsSection } from "@/lib/docs/types";

import "./docs.css";

type DocsLayoutProps = {
  slug: string;
  editPath: string;
  sections: DocsSection[];
  children: ReactNode;
};

export function DocsLayout({ slug, editPath, sections, children }: DocsLayoutProps) {
  const breadcrumb = getBreadcrumbTrail(slug);
  const searchEntries = buildDocsSearchIndex();

  return (
    <div className="docs-shell">
      <div className="docs-toolbar">
        <DocsBreadcrumb trail={breadcrumb} />
        <DocsSearch entries={searchEntries} />
      </div>

      <div className="docs-grid">
        <DocsSidebar navTree={docsNavTree} />

        <div className="docs-main">
          <div className="docs-content-header">
            <DocsEditLink editPath={editPath} />
          </div>
          <article className="docs-content">{children}</article>
        </div>

        <DocsToc sections={sections} />
      </div>
    </div>
  );
}
