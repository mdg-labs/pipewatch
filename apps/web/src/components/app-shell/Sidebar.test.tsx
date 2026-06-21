import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import en from "@/i18n/locales/en.json";

import { buildSettingsNavItems, Sidebar } from "./Sidebar";

let mockPathname = "/workspaces/mdg-labs/settings/members";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/env", () => ({
  publicApiUrl: "https://api.example.test",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    ...props
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

function sidebarT(key: keyof typeof en.app.sidebar): string {
  return en.app.sidebar[key];
}

function renderSidebar(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>,
  );
}

function navLinkTag(html: string, href: string): string {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<a[^>]*href="${escaped}"[^>]*>`));
  if (!match) {
    throw new Error(`nav link not found for href="${href}"`);
  }
  return match[0];
}

function isNavLinkActive(tag: string): boolean {
  return (
    tag.includes("pw-app-nav-item-active") || tag.includes('aria-current="page"')
  );
}

describe("buildSettingsNavItems", () => {
  it("includes billing when enabled", () => {
    const items = buildSettingsNavItems("mdg-labs", true, sidebarT);
    expect(items.map((item) => item.id)).toEqual([
      "general",
      "members",
      "integrations",
      "api-keys",
      "billing",
    ]);
  });

  it("hides billing when billing nav is disabled", () => {
    const items = buildSettingsNavItems("mdg-labs", false, sidebarT);
    expect(items.map((item) => item.id)).toEqual([
      "general",
      "members",
      "integrations",
      "api-keys",
    ]);
    expect(items.some((item) => item.id === "billing")).toBe(false);
  });
});

describe("Sidebar", () => {
  it("renders primary nav and settings children", () => {
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(html).toContain(en.app.sidebar.dashboard);
    expect(html).toContain(en.app.sidebar.insights);
    expect(html).toContain(en.app.sidebar.settings);
    expect(html).toContain('href="/workspaces/mdg-labs/settings/members"');
    expect(html).not.toContain('href="/workspaces/mdg-labs/settings/billing"');
  });

  it("renders billing settings link when billing nav is enabled", () => {
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling />,
    );

    expect(html).toContain('href="/workspaces/mdg-labs/settings/billing"');
  });

  it("renders API docs footer link from configured API URL", () => {
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(html).toContain('href="https://api.example.test/api/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain(en.app.sidebar.apiDocs);
  });

  it("marks Dashboard active only on workspace root", () => {
    mockPathname = "/workspaces/mdg-labs";
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs"))).toBe(
      true,
    );
    expect(
      isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs/insights")),
    ).toBe(false);
  });

  it("marks Insights active on insights path, not Dashboard", () => {
    mockPathname = "/workspaces/mdg-labs/insights";
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(
      isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs/insights")),
    ).toBe(true);
    expect(isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs"))).toBe(
      false,
    );
  });

  it("does not mark Dashboard active on settings members path", () => {
    mockPathname = "/workspaces/mdg-labs/settings/members";
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs"))).toBe(
      false,
    );
    expect(
      isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs/settings/members")),
    ).toBe(true);
  });

  it("does not mark Dashboard active on repository path", () => {
    mockPathname = "/workspaces/mdg-labs/repositories/acme/widget";
    const html = renderSidebar(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs"))).toBe(
      false,
    );
    expect(
      isNavLinkActive(navLinkTag(html, "/workspaces/mdg-labs/insights")),
    ).toBe(false);
  });
});
