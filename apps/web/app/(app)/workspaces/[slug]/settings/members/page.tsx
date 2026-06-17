"use client";

import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function WorkspaceMembersSettingsPage() {
  const { canMutate } = useWorkspaceRole();

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Members</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Active members and pending invites will load here.
      </p>
      <button type="button" disabled={!canMutate}>
        Invite member
      </button>
    </section>
  );
}
