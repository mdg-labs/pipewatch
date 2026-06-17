"use client";

import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function WorkspaceSettingsGeneralPage() {
  const { canMutate } = useWorkspaceRole();

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>General</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Workspace name, slug, and danger zone settings will load here.
      </p>
      <button type="button" disabled={!canMutate}>
        Save changes
      </button>
    </section>
  );
}
