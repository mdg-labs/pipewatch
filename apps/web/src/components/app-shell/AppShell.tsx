"use client";

import { LogoWordmark } from "@pipewatch/ui";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { isBillingNavEnabled, isWorkspaceSwitcherEnabled } from "@/lib/edition-guards";
import type { AppSession } from "@/lib/placeholder-session";

import "./app-shell.css";

import { useLiveStreamOverride } from "@/contexts/live-stream-override-context";
import { useRepoStream } from "@/hooks/use-repo-stream";

import { Breadcrumbs } from "./Breadcrumbs";
import { LiveIndicator } from "./LiveIndicator";
import { Sidebar } from "./Sidebar";
import { EditionBadge, UserMenu } from "./UserMenu";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export type AppShellProps = {
  session: AppSession;
  children: React.ReactNode;
};

function extractWorkspaceSlug(pathname: string, fallbackSlug: string): string {
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  return match?.[1] ?? fallbackSlug;
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const workspaceSlug = useMemo(
    () => extractWorkspaceSlug(pathname, session.activeWorkspaceSlug),
    [pathname, session.activeWorkspaceSlug],
  );
  const showBilling = isBillingNavEnabled();
  const showWorkspaceSwitcher = isWorkspaceSwitcherEnabled();
  const liveStreamOverride = useLiveStreamOverride();
  const { status: repoLiveStatus } = useRepoStream({
    enabled: liveStreamOverride === null,
  });
  const liveStatus = liveStreamOverride ?? repoLiveStatus;

  return (
    <div className="pw-app-shell">
      <aside className="pw-app-sidebar" aria-label="App navigation">
        <div className="pw-app-sidebar-header">
          <LogoWordmark markSize={20} />
          <EditionBadge isCloud={showWorkspaceSwitcher} />
        </div>

        <WorkspaceSwitcher
          workspaces={session.workspaces}
          activeSlug={workspaceSlug}
          enabled={showWorkspaceSwitcher}
        />

        <Sidebar workspaceSlug={workspaceSlug} showBilling={showBilling} />

        <UserMenu
          user={session.user}
          workspaceSlug={workspaceSlug}
          isCloud={showWorkspaceSwitcher}
        />
      </aside>

      <div className="pw-app-main">
        <header className="pw-app-topbar">
          <Breadcrumbs workspaceSlug={workspaceSlug} />
          <div className="pw-app-topbar-actions">
            <LiveIndicator status={liveStatus} />
          </div>
        </header>

        <div className="pw-app-content">{children}</div>
      </div>
    </div>
  );
}
