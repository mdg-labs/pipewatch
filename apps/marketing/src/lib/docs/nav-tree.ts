import { CLOUD_API_DOCS_URL } from "@/lib/api-docs";

import { DOCS_DEFAULT_SLUG } from "./constants";
import type { DocsNavSection } from "./types";

export const docsNavTree: DocsNavSection[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Cloud quickstart", slug: "getting-started/cloud-quickstart" },
      { title: "CE quickstart", slug: "getting-started/ce-quickstart" },
    ],
  },
  {
    title: "GitHub App Setup",
    items: [
      { title: "Creating the app", slug: "github-app-setup/creating-the-app" },
      { title: "Permissions & events", slug: "github-app-setup/permissions-and-events" },
      { title: "Webhook URL", slug: "github-app-setup/webhook-url" },
      { title: "Cloudflare Tunnel guide", slug: "github-app-setup/cloudflare-tunnel" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { title: "Workspaces", slug: "concepts/workspaces" },
      { title: "Integrations", slug: "concepts/integrations" },
      { title: "Run lifecycle", slug: "concepts/run-lifecycle" },
      { title: "Webhook vs polling mode", slug: "concepts/webhook-vs-polling" },
      { title: "Editions", slug: "concepts/editions" },
    ],
  },
  {
    title: "Self-Hosted (CE) Reference",
    items: [
      { title: "Environment variables", slug: "ce-reference/environment-variables" },
      { title: "Docker Compose config", slug: "ce-reference/docker-compose" },
      { title: "Upgrading", slug: "ce-reference/upgrading" },
      { title: "Backups", slug: "ce-reference/backups" },
    ],
  },
  {
    title: "API Reference",
    items: [{ title: "REST API (Scalar)", externalHref: CLOUD_API_DOCS_URL }],
  },
];

export function getAllDocSlugs(): string[] {
  return docsNavTree.flatMap((section) =>
    section.items.flatMap((item) => (item.slug ? [item.slug] : [])),
  );
}

export function getDefaultDocSlug(): string {
  return DOCS_DEFAULT_SLUG;
}

export function findNavSectionForSlug(slug: string): string | undefined {
  for (const section of docsNavTree) {
    if (section.items.some((item) => item.slug === slug)) {
      return section.title;
    }
  }
  return undefined;
}

export function getBreadcrumbTrail(slug: string): { label: string; href?: string }[] {
  const trail: { label: string; href?: string }[] = [{ label: "Docs", href: "/docs" }];

  for (const section of docsNavTree) {
    const match = section.items.find((item) => item.slug === slug);
    if (match) {
      trail.push({ label: section.title });
      trail.push({ label: match.title });
      break;
    }
  }

  return trail;
}
