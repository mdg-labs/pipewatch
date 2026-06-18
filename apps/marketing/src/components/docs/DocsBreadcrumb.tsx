import Link from "next/link";

type DocsBreadcrumbProps = {
  trail: { label: string; href?: string }[];
};

export function DocsBreadcrumb({ trail }: DocsBreadcrumbProps) {
  return (
    <nav className="docs-breadcrumb" aria-label="Breadcrumb">
      <ol className="docs-breadcrumb-list">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="docs-breadcrumb-item">
              {item.href && !isLast ? (
                <Link href={item.href} className="docs-breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span className="docs-breadcrumb-current" aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <span className="docs-breadcrumb-separator">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
