"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { classNames } from "@pipewatch/ui";

export type BreadcrumbSegment = {
  label: string;
  href?: string | undefined;
};

export type BreadcrumbsProps = {
  workspaceSlug: string;
};

const KNOWN_SEGMENTS = [
  "insights",
  "settings",
  "members",
  "integrations",
  "api-keys",
  "billing",
  "repos",
  "runs",
] as const;

type BreadcrumbTranslator = (
  key:
    | "dashboard"
    | "insights"
    | "settings"
    | "members"
    | "integrations"
    | "apiKeys"
    | "billing"
    | "repos"
    | "runs",
) => string;

function titleCase(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function segmentLabel(
  part: string,
  t: BreadcrumbTranslator,
): string {
  switch (part) {
    case "insights":
      return t("insights");
    case "settings":
      return t("settings");
    case "members":
      return t("members");
    case "integrations":
      return t("integrations");
    case "api-keys":
      return t("apiKeys");
    case "billing":
      return t("billing");
    case "repos":
      return t("repos");
    case "runs":
      return t("runs");
    default:
      return titleCase(part);
  }
}

export function buildBreadcrumbSegments(
  pathname: string,
  workspaceSlug: string,
  t: BreadcrumbTranslator,
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
    segments.push({ label: t("dashboard") });
    return segments;
  }

  const parts = remainder.split("/").filter(Boolean);
  let currentPath = prefix;

  parts.forEach((part, index) => {
    currentPath += `/${part}`;
    const isLast = index === parts.length - 1;
    const label = KNOWN_SEGMENTS.includes(part as (typeof KNOWN_SEGMENTS)[number])
      ? segmentLabel(part, t)
      : titleCase(part);

    segments.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });

  return segments;
}

export function Breadcrumbs({ workspaceSlug }: BreadcrumbsProps) {
  const pathname = usePathname() ?? "";
  const t = useTranslations("app.breadcrumbs");
  const segments = useMemo(
    () => buildBreadcrumbSegments(pathname, workspaceSlug, t),
    [pathname, workspaceSlug, t],
  );

  return (
    <nav aria-label={t("ariaLabel")}>
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
