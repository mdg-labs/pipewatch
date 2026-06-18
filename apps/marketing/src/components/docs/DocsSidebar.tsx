"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import type { DocsNavSection } from "@/lib/docs/types";

type DocsSidebarProps = {
  navTree: DocsNavSection[];
};

function getActiveSlug(pathname: string): string | null {
  if (!pathname.startsWith("/docs/")) {
    return null;
  }

  return pathname.slice("/docs/".length);
}

export function DocsSidebar({ navTree }: DocsSidebarProps) {
  const pathname = usePathname();
  const activeSlug = getActiveSlug(pathname);

  const defaultExpanded = useMemo(() => {
    const expanded = new Set<string>();
    for (const section of navTree) {
      if (section.items.some((item) => item.slug === activeSlug)) {
        expanded.add(section.title);
      }
    }

    if (expanded.size === 0 && navTree[0]) {
      expanded.add(navTree[0].title);
    }

    return expanded;
  }, [activeSlug, navTree]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(defaultExpanded);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSection = (title: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        className="docs-sidebar-toggle"
        aria-expanded={mobileOpen}
        aria-controls="docs-sidebar-nav"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? "Hide navigation" : "Show navigation"}
      </button>

      <aside
        id="docs-sidebar-nav"
        className={`docs-sidebar${mobileOpen ? " docs-sidebar-open" : ""}`}
        aria-label="Documentation"
      >
        <nav className="docs-sidebar-nav">
          {navTree.map((section) => {
            const isExpanded = expandedSections.has(section.title);

            return (
              <div key={section.title} className="docs-sidebar-section">
                <button
                  type="button"
                  className="docs-sidebar-section-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => toggleSection(section.title)}
                >
                  <span className="docs-sidebar-section-title">{section.title}</span>
                  <span className="docs-sidebar-section-icon" aria-hidden>
                    {isExpanded ? "−" : "+"}
                  </span>
                </button>

                {isExpanded ? (
                  <ul className="docs-sidebar-links">
                    {section.items.map((item) => {
                      if (item.externalHref) {
                        return (
                          <li key={item.externalHref}>
                            <a
                              href={item.externalHref}
                              className="docs-sidebar-link"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.title}
                            </a>
                          </li>
                        );
                      }

                      if (!item.slug) {
                        return null;
                      }

                      const href = `/docs/${item.slug}`;
                      const isActive = activeSlug === item.slug;

                      return (
                        <li key={item.slug}>
                          <Link
                            href={href}
                            className={`docs-sidebar-link${isActive ? " docs-sidebar-link-active" : ""}`}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setMobileOpen(false)}
                          >
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
