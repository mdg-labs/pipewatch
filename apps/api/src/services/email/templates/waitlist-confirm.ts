import type { RenderedEmail } from "./invite.js";

export type WaitlistConfirmEmailParams = {
  confirmUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Waitlist double opt-in confirmation via SMTP (PRD §21). */
export function renderWaitlistConfirmEmail(
  params: WaitlistConfirmEmailParams,
): RenderedEmail {
  const subject = "Confirm your waitlist subscription";
  const text = [
    "Thanks for joining the PipeWatch waitlist.",
    "",
    "Confirm your email to receive launch updates:",
    params.confirmUrl,
    "",
    "If you did not subscribe, you can ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body>
    <p>Thanks for joining the PipeWatch waitlist.</p>
    <p>Confirm your email to receive launch updates:</p>
    <p><a href="${escapeHtml(params.confirmUrl)}">Confirm subscription</a></p>
    <p>If you did not subscribe, you can ignore this email.</p>
  </body>
</html>`;

  return { subject, html, text };
}
