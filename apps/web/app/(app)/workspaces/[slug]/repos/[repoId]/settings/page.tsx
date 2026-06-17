"use client";

import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function RepositorySettingsPage() {
  const { canMutate } = useWorkspaceRole();

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
        Repository settings
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Sync mode, retention, and repository actions will load here.
      </p>
      <button type="button" disabled={!canMutate}>
        Save settings
      </button>
    </section>
  );
}
