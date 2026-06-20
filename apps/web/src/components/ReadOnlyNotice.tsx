"use client";

import { useTranslations } from "next-intl";

import { useWorkspaceRole } from "@/hooks/use-workspace-role";

/** Inline banner when a member views an admin settings page read-only. */
export function ReadOnlyNotice() {
  const { readOnly } = useWorkspaceRole();
  const t = useTranslations("common");

  if (!readOnly) {
    return null;
  }

  return (
    <div
      className="pw-read-only-notice"
      role="status"
      style={{
        marginBottom: 16,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--surface-muted, rgba(0, 0, 0, 0.04))",
        color: "var(--text-secondary)",
        fontSize: 14,
      }}
    >
      {t("readOnlyNotice")}
    </div>
  );
}
