import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildSettingsNavItems, Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspaces/mdg-labs/settings/members",
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

describe("buildSettingsNavItems", () => {
  it("includes billing when enabled", () => {
    const items = buildSettingsNavItems("mdg-labs", true);
    expect(items.map((item) => item.id)).toEqual([
      "general",
      "members",
      "integrations",
      "api-keys",
      "billing",
    ]);
  });

  it("hides billing when billing nav is disabled", () => {
    const items = buildSettingsNavItems("mdg-labs", false);
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
    const html = renderToStaticMarkup(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Insights");
    expect(html).toContain("Settings");
    expect(html).toContain('href="/workspaces/mdg-labs/settings/members"');
    expect(html).not.toContain('href="/workspaces/mdg-labs/settings/billing"');
  });

  it("renders billing settings link when billing nav is enabled", () => {
    const html = renderToStaticMarkup(
      <Sidebar workspaceSlug="mdg-labs" showBilling />,
    );

    expect(html).toContain('href="/workspaces/mdg-labs/settings/billing"');
  });

  it("renders API docs footer link from configured API URL", () => {
    const html = renderToStaticMarkup(
      <Sidebar workspaceSlug="mdg-labs" showBilling={false} />,
    );

    expect(html).toContain('href="https://api.example.test/api/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("API Docs");
  });
});
