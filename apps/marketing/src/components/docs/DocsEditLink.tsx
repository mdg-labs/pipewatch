import { DOCS_EDIT_ON_GITHUB_BASE } from "@/lib/docs/constants";

type DocsEditLinkProps = {
  editPath: string;
};

export function DocsEditLink({ editPath }: DocsEditLinkProps) {
  const href = `${DOCS_EDIT_ON_GITHUB_BASE}/${editPath}`;

  return (
    <a
      href={href}
      className="docs-edit-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      Edit on GitHub
    </a>
  );
}
