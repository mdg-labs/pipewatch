"use client";

import {
  BarChart3,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  Plug,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { classNames } from "@pipewatch/ui";

export type SidebarNavItem = {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
};

export type SettingsNavItem = {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
};

export type SidebarProps = {
  workspaceSlug: string;
  showBilling: boolean;
};

function workspacePath(slug: string, segment = ""): string {
  return `/workspaces/${slug}${segment}`;
}

function isActivePath(pathname: string, href: string): boolean {
  if (href.endsWith("/settings")) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function buildSettingsNavItems(
  workspaceSlug: string,
  showBilling: boolean,
): SettingsNavItem[] {
  const base = workspacePath(workspaceSlug, "/settings");
  const items: SettingsNavItem[] = [
    {
      id: "general",
      label: "General",
      href: base,
      icon: <Settings size={13} aria-hidden />,
    },
    {
      id: "members",
      label: "Members",
      href: `${base}/members`,
      icon: <Users size={13} aria-hidden />,
    },
    {
      id: "integrations",
      label: "Integrations",
      href: `${base}/integrations`,
      icon: <Plug size={13} aria-hidden />,
    },
    {
      id: "api-keys",
      label: "API Keys",
      href: `${base}/api-keys`,
      icon: <KeyRound size={13} aria-hidden />,
    },
  ];

  if (showBilling) {
    items.push({
      id: "billing",
      label: "Billing",
      href: `${base}/billing`,
      icon: <Wallet size={13} aria-hidden />,
    });
  }

  return items;
}

export function Sidebar({ workspaceSlug, showBilling }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const settingsItems = useMemo(
    () => buildSettingsNavItems(workspaceSlug, showBilling),
    [workspaceSlug, showBilling],
  );
  const settingsActive = settingsItems.some((item) =>
    isActivePath(pathname, item.href),
  );
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  const primaryNav: SidebarNavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: workspacePath(workspaceSlug),
      icon: <LayoutDashboard size={14} aria-hidden />,
    },
    {
      id: "insights",
      label: "Insights",
      href: workspacePath(workspaceSlug, "/insights"),
      icon: <BarChart3 size={14} aria-hidden />,
    },
  ];

  return (
    <nav className="pw-app-sidebar-nav" aria-label="Workspace">
      {primaryNav.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.id}
            href={item.href}
            className={classNames(
              "pw-app-nav-item",
              active && "pw-app-nav-item-active",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className="pw-app-nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      <div>
        <button
          type="button"
          className={classNames(
            "pw-app-nav-toggle",
            settingsActive && "pw-app-nav-item-active",
          )}
          aria-expanded={settingsOpen}
          aria-controls="pw-settings-subnav"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <span className="pw-app-nav-icon">
            <Settings size={14} aria-hidden />
          </span>
          Settings
          <ChevronDown
            size={12}
            aria-hidden
            className={classNames(
              "pw-app-nav-chevron",
              settingsOpen && "pw-app-nav-chevron-open",
            )}
          />
        </button>

        {settingsOpen ? (
          <div id="pw-settings-subnav" className="pw-app-nav-sub">
            {settingsItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={classNames(
                    "pw-app-nav-item",
                    active && "pw-app-nav-item-active",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="pw-app-nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
