export type WorkspaceInviteEmailParams = {
  workspaceName: string;
  inviterName: string | null;
  inviteUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Workspace invite transactional email (PRD §21). */
export function renderWorkspaceInviteEmail(
  params: WorkspaceInviteEmailParams,
): RenderedEmail {
  const workspaceName = params.workspaceName.trim() || "a workspace";
  const inviterLabel = params.inviterName?.trim()
    ? `${params.inviterName.trim()} invited you`
    : "You have been invited";

  const subject = `You've been invited to ${workspaceName}`;
  const text = [
    `${inviterLabel} to join ${workspaceName} on PipeWatch.`,
    "",
    "Accept the invite:",
    params.inviteUrl,
    "",
    "If you did not expect this invite, you can ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body>
    <p>${escapeHtml(inviterLabel)} to join <strong>${escapeHtml(workspaceName)}</strong> on PipeWatch.</p>
    <p><a href="${escapeHtml(params.inviteUrl)}">Accept invite</a></p>
    <p>If you did not expect this invite, you can ignore this email.</p>
  </body>
</html>`;

  return { subject, html, text };
}
