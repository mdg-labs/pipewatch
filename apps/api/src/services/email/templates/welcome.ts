import type { RenderedEmail } from "./invite.js";

export type WelcomeEmailParams = {
  recipientName: string | null;
  appUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Welcome email sent on first OAuth login (PRD §21). */
export function renderWelcomeEmail(params: WelcomeEmailParams): RenderedEmail {
  const greetingName = params.recipientName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";
  const dashboardUrl = params.appUrl.replace(/\/$/, "");

  const subject = "Welcome to PipeWatch";
  const text = [
    greeting,
    "",
    "Your account is ready. Open the dashboard to connect repositories and monitor pipeline runs.",
    "",
    dashboardUrl,
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body>
    <p>${escapeHtml(greeting)}</p>
    <p>Your account is ready. Open the dashboard to connect repositories and monitor pipeline runs.</p>
    <p><a href="${escapeHtml(dashboardUrl)}">Open PipeWatch</a></p>
    <p>If you did not create this account, you can ignore this email.</p>
  </body>
</html>`;

  return { subject, html, text };
}
