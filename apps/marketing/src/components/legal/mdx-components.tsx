import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";

import { slugifyHeading } from "@/lib/legal";

export type LegalMdxComponents = {
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => ReactElement;
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => ReactElement;
  p: (props: HTMLAttributes<HTMLParagraphElement>) => ReactElement;
  ul: (props: HTMLAttributes<HTMLUListElement>) => ReactElement;
  ol: (props: HTMLAttributes<HTMLOListElement>) => ReactElement;
  li: (props: HTMLAttributes<HTMLLIElement>) => ReactElement;
  a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => ReactElement;
  strong: (props: HTMLAttributes<HTMLElement>) => ReactElement;
};

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

  return function LegalHeading({ children }: { children?: ReactNode }) {
    const title = getTextContent(children).trim();
    const id = slugifyHeading(title);

    return (
      <Tag id={id} className={`legal-heading legal-h${level}`}>
        <a href={`#${id}`} className="legal-heading-anchor" aria-hidden="true">
          #
        </a>
        {children}
      </Tag>
    );
  };
}

export const legalMdxComponents: LegalMdxComponents = {
  h2: createHeading(2),
  h3: createHeading(3),
  p: ({ children }: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="legal-paragraph">{children}</p>
  ),
  ul: ({ children }: HTMLAttributes<HTMLUListElement>) => (
    <ul className="legal-list">{children}</ul>
  ),
  ol: ({ children }: HTMLAttributes<HTMLOListElement>) => (
    <ol className="legal-list legal-list-ordered">{children}</ol>
  ),
  li: ({ children }: HTMLAttributes<HTMLLIElement>) => (
    <li className="legal-list-item">{children}</li>
  ),
  a: ({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="legal-link"
      rel={typeof href === "string" && href.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  strong: ({ children }: HTMLAttributes<HTMLElement>) => (
    <strong className="legal-strong">{children}</strong>
  ),
};
