import type { ApiEnv } from "@pipewatch/config/env";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer/index.js";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailEnv = Pick<
  ApiEnv,
  "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM"
>;

export type SendEmailResult = {
  sent: boolean;
};

export type EmailTransport = Pick<Mail<SMTPTransport.SentMessageInfo>, "sendMail">;

function isEmailConfigured(env: SendEmailEnv): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function createSmtpTransport(env: SendEmailEnv): EmailTransport {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: false,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } } : {}),
  });
}

/** Send a transactional email via SMTP; no-op when `SMTP_HOST` is unset (PRD §21). */
export async function sendEmail(
  env: SendEmailEnv,
  input: SendEmailInput,
  transport?: EmailTransport,
): Promise<SendEmailResult> {
  if (!isEmailConfigured(env)) {
    return { sent: false };
  }

  const mailer = transport ?? createSmtpTransport(env);

  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return { sent: true };
}
