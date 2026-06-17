import { eq } from "drizzle-orm";

import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { subscribers } from "@pipewatch/db/schema";

import {
  sendEmail,
  type EmailTransport,
  type SendEmailEnv,
} from "../email/send-email.js";
import { renderWaitlistConfirmEmail } from "../email/templates/waitlist-confirm.js";

export const WAITLIST_SOURCE = "pipewatch_waitlist";

export type WaitlistServiceEnv = Pick<
  ApiEnv,
  "APP_URL" | "PORT" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM"
>;

export type SubscribeResult = {
  status: "subscribed" | "already_subscribed";
  email_sent: boolean;
};

export type TokenActionResult = {
  status: "confirmed" | "already_confirmed" | "unsubscribed" | "already_unsubscribed";
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Derive the public API base URL for waitlist action links (PRD §14). */
export function resolveApiBaseUrl(appUrl: string | undefined, port: number): string {
  if (!appUrl) {
    return `http://localhost:${String(port)}`;
  }

  const trimmed = appUrl.replace(/\/$/, "");
  if (trimmed.includes("://cloud.")) {
    return trimmed.replace("://cloud.", "://api.");
  }

  return trimmed;
}

export function buildWaitlistConfirmUrl(apiBaseUrl: string, token: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/waitlist/confirm/${token}`;
}

async function deliverConfirmEmail(
  env: WaitlistServiceEnv,
  params: { to: string; token: string },
  transport?: EmailTransport,
): Promise<boolean> {
  const apiBaseUrl = resolveApiBaseUrl(env.APP_URL, env.PORT ?? 3001);
  const confirmUrl = buildWaitlistConfirmUrl(apiBaseUrl, params.token);
  const rendered = renderWaitlistConfirmEmail({ confirmUrl });

  const smtpEnv: SendEmailEnv = {
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    SMTP_FROM: env.SMTP_FROM,
  };

  const result = await sendEmail(
    smtpEnv,
    {
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    },
    transport,
  );

  return result.sent;
}

/** Subscribe an email to the waitlist with double opt-in (PRD §14). */
export async function subscribeToWaitlist(
  database: Db,
  env: WaitlistServiceEnv,
  email: string,
  transport?: EmailTransport,
): Promise<SubscribeResult> {
  const normalized = normalizeEmail(email);

  const [existing] = await database
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, normalized))
    .limit(1);

  if (existing) {
    if (existing.unsubscribedAt) {
      const [reactivated] = await database
        .update(subscribers)
        .set({
          unsubscribedAt: null,
          confirmedAt: null,
          source: WAITLIST_SOURCE,
        })
        .where(eq(subscribers.id, existing.id))
        .returning();

      if (!reactivated) {
        throw new Error("Failed to reactivate waitlist subscriber");
      }

      const emailSent = await deliverConfirmEmail(
        env,
        { to: normalized, token: reactivated.unsubscribeToken },
        transport,
      );

      return { status: "subscribed", email_sent: emailSent };
    }

    if (!existing.confirmedAt) {
      const emailSent = await deliverConfirmEmail(
        env,
        { to: normalized, token: existing.unsubscribeToken },
        transport,
      );

      return { status: "already_subscribed", email_sent: emailSent };
    }

    return { status: "already_subscribed", email_sent: false };
  }

  const [created] = await database
    .insert(subscribers)
    .values({
      email: normalized,
      source: WAITLIST_SOURCE,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create waitlist subscriber");
  }

  const emailSent = await deliverConfirmEmail(
    env,
    { to: normalized, token: created.unsubscribeToken },
    transport,
  );

  return { status: "subscribed", email_sent: emailSent };
}

/** Confirm a waitlist subscription via token (PRD §14). */
export async function confirmWaitlistSubscription(
  database: Db,
  token: string,
): Promise<TokenActionResult | null> {
  const [subscriber] = await database
    .select()
    .from(subscribers)
    .where(eq(subscribers.unsubscribeToken, token))
    .limit(1);

  if (!subscriber) {
    return null;
  }

  if (subscriber.unsubscribedAt) {
    return null;
  }

  if (subscriber.confirmedAt) {
    return { status: "already_confirmed" };
  }

  await database
    .update(subscribers)
    .set({ confirmedAt: new Date() })
    .where(eq(subscribers.id, subscriber.id));

  return { status: "confirmed" };
}

/** Unsubscribe a waitlist subscriber via token (PRD §14). */
export async function unsubscribeFromWaitlist(
  database: Db,
  token: string,
): Promise<TokenActionResult | null> {
  const [subscriber] = await database
    .select()
    .from(subscribers)
    .where(eq(subscribers.unsubscribeToken, token))
    .limit(1);

  if (!subscriber) {
    return null;
  }

  if (subscriber.unsubscribedAt) {
    return { status: "already_unsubscribed" };
  }

  await database
    .update(subscribers)
    .set({ unsubscribedAt: new Date() })
    .where(eq(subscribers.id, subscriber.id));

  return { status: "unsubscribed" };
}
