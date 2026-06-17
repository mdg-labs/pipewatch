"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { classNames } from "@pipewatch/ui";

export type BreadcrumbSegment = {
  label: string;
  href?: string | undefined;
};

export type BreadcrumbsProps = {
  workspaceSlug: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  insights: "Insights",
  settings: "Settings",
  members: "Members",
  integrations: "Integrations",
  "api-keys": "API Keys",
  billing: "Billing",
  repos: "Repositories",
  runs: "Runs",
};

function titleCase(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildBreadcrumbSegments(
  pathname: string,
  workspaceSlug: string,
): BreadcrumbSegment[] {
  const prefix = `/workspaces/${workspaceSlug}`;
  const segments: BreadcrumbSegment[] = [
    {
      label: workspaceSlug,
      href: prefix,
    },
  ];

  if (!pathname.startsWith(prefix)) {
    return segments;
  }

  const remainder = pathname.slice(prefix.length).replace(/^\//, "");
  if (!remainder) {
    segments.push({ label: "Dashboard" });
    return segments;
  }

  const parts = remainder.split("/").filter(Boolean);
  let currentPath = prefix;

  parts.forEach((part, index) => {
    currentPath += `/${part}`;
    const isLast = index === parts.length - 1;
    const label = SEGMENT_LABELS[part] ?? titleCase(part);

    segments.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });

  return segments;
}

export function Breadcrumbs({ workspaceSlug }: BreadcrumbsProps) {
  const pathname = usePathname() ?? "";
  const segments = useMemo(
    () => buildBreadcrumbSegments(pathname, workspaceSlug),
    [pathname, workspaceSlug],
  );

  return (
    <nav aria-label="Breadcrumb">
      <ol className="pw-app-breadcrumbs">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <li
              key={`${segment.label}-${index}`}
              className="pw-app-breadcrumb-item"
            >
              {index > 0 ? (
                <span className="pw-app-breadcrumb-sep" aria-hidden>
                  /
                </span>
              ) : null}
              {segment.href && !isLast ? (
                <Link href={segment.href} className="pw-app-breadcrumb-link">
                  {segment.label}
                </Link>
              ) : (
                <span
                  className={classNames(
                    isLast && "pw-app-breadcrumb-current",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {segment.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
