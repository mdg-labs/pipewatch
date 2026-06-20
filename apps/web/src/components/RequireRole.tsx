"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  WorkspaceRoleContext,
  useWorkspaceRole,
} from "@/hooks/use-workspace-role";

export type RequireRoleProps = {
  /** Minimum role to mutate; members may still view admin pages read-only. */
  minimumRole: "admin" | "owner";
  children: ReactNode;
  /** Shown when the user lacks the required role (owner-only routes). */
  fallback?: ReactNode;
};

function DefaultForbiddenMessage() {
  const t = useTranslations("access.forbidden");

  return (
    <section className="pw-forbidden" role="alert">
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
        {t("title")}
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        {t("message")}
      </p>
    </section>
  );
}

/**
 * Gate settings and mutation routes by workspace role (B5, B8–B12).
 * `admin` allows members to view read-only; `owner` blocks non-owners entirely.
 */
export function RequireRole({
  minimumRole,
  children,
  fallback = <DefaultForbiddenMessage />,
}: RequireRoleProps) {
  const { role, meetsMinimum } = useWorkspaceRole();

  if (!role) {
    return fallback;
  }

  if (minimumRole === "owner") {
    return meetsMinimum("owner") ? children : fallback;
  }

  const readOnly = !meetsMinimum("admin");

  return (
    <WorkspaceRoleContext.Provider value={{ readOnly }}>
      {children}
    </WorkspaceRoleContext.Provider>
  );
}
