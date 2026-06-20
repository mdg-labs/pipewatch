import type { AdminEnv } from "@pipewatch/config/env";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer/index.js";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

export type EmailTransport = Pick<Mail<SMTPTransport.SentMessageInfo>, "sendMail">;

export type InviteMailEnv = Pick<
  AdminEnv,
  "ADMIN_URL" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM"
>;

export type InviteDeliveryResult = {
  emailSent: boolean;
  inviteUrl?: string;
};

function isSmtpConfigured(env: InviteMailEnv): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function createSmtpTransport(env: InviteMailEnv): EmailTransport {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: false,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } } : {}),
  });
}

/** Build the invite acceptance URL shown in email or returned when SMTP is unset. */
export function buildAdminInviteUrl(adminUrl: string | undefined, token: string): string {
  const base = adminUrl?.replace(/\/$/, "") ?? "http://localhost:3002";
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

function renderInviteEmail(inviteUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "PipeWatch Admin portal invitation",
    html: `<p>You have been invited to the PipeWatch Admin portal.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    text: `You have been invited to the PipeWatch Admin portal.\n\nAccept invitation: ${inviteUrl}`,
  };
}

/** Send an admin invite email via SMTP; return the link when SMTP is unset (Admin PRD §8.3). */
export async function sendAdminInviteEmail(
  env: InviteMailEnv,
  params: { to: string; token: string },
  transport?: EmailTransport,
): Promise<InviteDeliveryResult> {
  const inviteUrl = buildAdminInviteUrl(env.ADMIN_URL, params.token);

  if (!isSmtpConfigured(env)) {
    return { emailSent: false, inviteUrl };
  }

  const rendered = renderInviteEmail(inviteUrl);
  const mailer = transport ?? createSmtpTransport(env);

  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  return { emailSent: true };
}
