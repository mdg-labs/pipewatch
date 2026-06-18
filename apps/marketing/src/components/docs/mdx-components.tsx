import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";

import { CodeBlock } from "@/components/docs/CodeBlock";
import { slugifyHeading } from "@/lib/legal";

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (node && typeof node === "object" && "props" in node) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return getTextContent(element.props.children);
  }

  return "";
}

function createHeading(level: 2 | 3) {
  const Tag = `h${level}` as const;

  return function DocsHeading({ children }: { children?: ReactNode }) {
    const title = getTextContent(children).trim();
    const id = slugifyHeading(title);

    return (
      <Tag id={id} className={`docs-heading docs-h${level}`}>
        <a href={`#${id}`} className="docs-heading-anchor" aria-hidden="true">
          #
        </a>
        {children}
      </Tag>
    );
  };
}

export const docsMdxComponents = {
  h2: createHeading(2),
  h3: createHeading(3),
  p: ({ children }: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="docs-paragraph">{children}</p>
  ),
  ul: ({ children }: HTMLAttributes<HTMLUListElement>) => (
    <ul className="docs-list">{children}</ul>
  ),
  ol: ({ children }: HTMLAttributes<HTMLOListElement>) => (
    <ol className="docs-list docs-list-ordered">{children}</ol>
  ),
  li: ({ children }: HTMLAttributes<HTMLLIElement>) => (
    <li className="docs-list-item">{children}</li>
  ),
  a: ({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="docs-link"
      rel={typeof href === "string" && href.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  strong: ({ children }: HTMLAttributes<HTMLElement>) => (
    <strong className="docs-strong">{children}</strong>
  ),
  pre: ({ children, className }: HTMLAttributes<HTMLPreElement>) => (
    <CodeBlock {...(className ? { className } : {})}>{children}</CodeBlock>
  ),
  code: ({ children, className }: HTMLAttributes<HTMLElement>) => {
    if (className) {
      return <code className={className}>{children}</code>;
    }

    return <code className="docs-inline-code">{children}</code>;
  },
};
