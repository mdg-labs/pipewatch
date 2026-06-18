"use client";

import { useEffect, useState } from "react";

import type { DocsSection } from "@/lib/docs/types";

type DocsTocProps = {
  sections: DocsSection[];
};

export function DocsToc({ sections }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    if (sections.length === 0) {
      return;
    }

    const headingElements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);

    if (headingElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: [0, 1],
      },
    );

    for (const element of headingElements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <aside className="docs-toc" aria-label="On this page">
      <p className="docs-toc-label">On this page</p>
      <ol className="docs-toc-list">
        {sections.map((section) => (
          <li
            key={section.id}
            className={`docs-toc-item docs-toc-level-${section.level}${
              activeId === section.id ? " docs-toc-item-active" : ""
            }`}
          >
            <a href={`#${section.id}`} className="docs-toc-link">
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
