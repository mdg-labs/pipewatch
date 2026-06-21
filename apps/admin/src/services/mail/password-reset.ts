import type { AdminEnv } from "@pipewatch/config/env";
import nodemailer from "nodemailer";

import type { EmailTransport } from "./invite.js";

export type PasswordResetMailEnv = Pick<
  AdminEnv,
  "ADMIN_URL" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM"
>;

export type PasswordResetDeliveryResult = {
  emailSent: boolean;
  resetUrl?: string;
};

function isSmtpConfigured(env: PasswordResetMailEnv): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function createSmtpTransport(env: PasswordResetMailEnv): EmailTransport {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: false,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } } : {}),
  });
}

/** Build the password reset URL shown in email or returned when SMTP is unset. */
export function buildAdminPasswordResetUrl(adminUrl: string | undefined, token: string): string {
  const base = adminUrl?.replace(/\/$/, "") ?? "http://localhost:3002";
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

function renderPasswordResetEmail(resetUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "PipeWatch Admin portal password reset",
    html: `<p>A password reset was requested for your PipeWatch Admin portal account.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    text: `A password reset was requested for your PipeWatch Admin portal account.\n\nReset password: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  };
}

/** Send a password reset email via SMTP; return the link when SMTP is unset. */
export async function sendAdminPasswordResetEmail(
  env: PasswordResetMailEnv,
  params: { to: string; token: string },
  transport?: EmailTransport,
): Promise<PasswordResetDeliveryResult> {
  const resetUrl = buildAdminPasswordResetUrl(env.ADMIN_URL, params.token);

  if (!isSmtpConfigured(env)) {
    return { emailSent: false, resetUrl };
  }

  const rendered = renderPasswordResetEmail(resetUrl);
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
