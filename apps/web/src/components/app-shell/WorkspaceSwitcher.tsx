"use client";

import { Building2, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Skeleton, classNames } from "@pipewatch/ui";
import type { WorkspaceListItem } from "@pipewatch/types";

export type WorkspaceSwitcherProps = {
  workspaces: WorkspaceListItem[];
  activeSlug: string;
  enabled: boolean;
  loading?: boolean;
};

export function WorkspaceSwitcher({
  workspaces,
  activeSlug,
  enabled,
  loading = false,
}: WorkspaceSwitcherProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="pw-app-workspace-skeleton" aria-busy="true">
        <Skeleton variant="rounded" width="100%" height={32} />
      </div>
    );
  }

  const activeWorkspace =
    workspaces.find((workspace) => workspace.slug === activeSlug) ??
    workspaces[0];

  return (
    <div className="pw-app-workspace-switcher" ref={containerRef}>
      <button
        type="button"
        className="pw-app-workspace-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <Building2 size={12} aria-hidden className="pw-app-nav-icon" />
        <span className="pw-app-workspace-slug">
          {activeWorkspace?.slug ?? activeSlug}
        </span>
        <ChevronDown size={10} aria-hidden className="pw-app-nav-icon" />
      </button>

      {open ? (
        <div
          id={menuId}
          className="pw-app-workspace-menu"
          role="listbox"
          aria-label="Workspaces"
        >
          {workspaces.map((workspace) => {
            const active = workspace.slug === activeSlug;

            return (
              <Link
                key={workspace.id}
                href={`/workspaces/${workspace.slug}`}
                className={classNames(
                  "pw-app-workspace-option",
                  active && "pw-app-workspace-option-active",
                )}
                role="option"
                aria-selected={active}
                onClick={() => setOpen(false)}
              >
                {workspace.slug}
              </Link>
            );
          })}

          <div className="pw-app-workspace-create">
            <Link
              href="/workspaces/new"
              className="pw-app-workspace-option"
              onClick={() => setOpen(false)}
            >
              <Plus size={12} aria-hidden style={{ marginRight: 6 }} />
              Create workspace
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
