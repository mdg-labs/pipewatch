import { describe, expect, it } from "vitest";

import { renderWorkspaceInviteEmail } from "./invite.js";

describe("renderWorkspaceInviteEmail", () => {
  it("renders invite copy with sentence case and no emoji", () => {
    const email = renderWorkspaceInviteEmail({
      workspaceName: "Acme CI",
      inviterName: "Jane Doe",
      inviteUrl: "https://cloud.pipewatch.app/invite/abc123",
    });

    expect(email.subject).toBe("You've been invited to Acme CI");
    expect(email.text).toContain("Jane Doe invited you to join Acme CI on PipeWatch.");
    expect(email.text).toContain("https://cloud.pipewatch.app/invite/abc123");
    expect(email.html).toContain("Jane Doe invited you");
    expect(email.html).toContain("Accept invite");
    expect(email.subject).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("falls back when inviter name is missing", () => {
    const email = renderWorkspaceInviteEmail({
      workspaceName: "Platform",
      inviterName: null,
      inviteUrl: "https://cloud.pipewatch.app/invite/token",
    });

    expect(email.text).toContain("You have been invited to join Platform on PipeWatch.");
  });
});
