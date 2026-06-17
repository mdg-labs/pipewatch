"use client";

import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function WorkspaceIntegrationsSettingsPage() {
  const { canMutate } = useWorkspaceRole();

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Integrations</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Connected GitHub App integrations will load here.
      </p>
      <button type="button" disabled={!canMutate}>
        Add integration
      </button>
    </section>
  );
}
