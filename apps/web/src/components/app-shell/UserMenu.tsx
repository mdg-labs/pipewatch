"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar, Badge, classNames } from "@pipewatch/ui";

import { publicApiUrl } from "@/lib/env";
import type { AppSessionUser } from "@/lib/placeholder-session";

export type UserMenuProps = {
  user: AppSessionUser;
  workspaceSlug: string;
  isCloud: boolean;
};

export function UserMenu({ user, workspaceSlug, isCloud }: UserMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  async function handleLogout() {
    if (loggingOut || !publicApiUrl) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch(`${publicApiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      window.location.assign("/sign-in");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="pw-app-user-menu" ref={containerRef}>
      <button
        type="button"
        className="pw-app-user-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar
          name={user.name}
          {...(user.avatarUrl ? { src: user.avatarUrl } : {})}
          size="sm"
          rounded
        />
        <span className="pw-app-user-meta">
          <span className="pw-app-user-name">{user.name}</span>
          <span className="pw-app-user-login">{user.githubLogin}</span>
        </span>
        <ChevronDown size={12} aria-hidden className="pw-app-nav-icon" />
      </button>

      {open ? (
        <div id={menuId} className="pw-app-user-dropdown" role="menu">
          <Link
            href="/account"
            className="pw-app-user-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <UserRound
              size={14}
              aria-hidden
              style={{ marginRight: 8, verticalAlign: "text-bottom" }}
            />
            Account
          </Link>

          {isCloud ? (
            <Link
              href={`/workspaces/${workspaceSlug}/settings/billing`}
              className="pw-app-user-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Billing
            </Link>
          ) : null}

          <button
            type="button"
            className={classNames(
              "pw-app-user-dropdown-item",
              "pw-app-user-dropdown-item-danger",
            )}
            role="menuitem"
            disabled={loggingOut}
            onClick={() => {
              setOpen(false);
              void handleLogout();
            }}
          >
            <LogOut
              size={14}
              aria-hidden
              style={{ marginRight: 8, verticalAlign: "text-bottom" }}
            />
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function EditionBadge({ isCloud }: { isCloud: boolean }) {
  return (
    <Badge variant="accent" mono className="pw-app-sidebar-edition">
      {isCloud ? "Cloud" : "CE"}
    </Badge>
  );
}
