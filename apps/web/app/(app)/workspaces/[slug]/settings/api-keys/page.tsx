"use client";

import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function WorkspaceApiKeysSettingsPage() {
  const { canMutate } = useWorkspaceRole();

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>API Keys</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Programmatic API access keys will load here.
      </p>
      <button type="button" disabled={!canMutate}>
        Create API key
      </button>
    </section>
  );
}
