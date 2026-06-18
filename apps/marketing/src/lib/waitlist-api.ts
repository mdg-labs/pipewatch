import { getApiUrl } from "./api-url";

export type WaitlistSubscribeResult = {
  status: "subscribed" | "already_subscribed";
  email_sent: boolean;
};

export type WaitlistActionStatus =
  | "confirmed"
  | "already_confirmed"
  | "unsubscribed"
  | "already_unsubscribed";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidWaitlistToken(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export async function subscribeWaitlist(
  email: string,
): Promise<
  | { ok: true; data: WaitlistSubscribeResult }
  | { ok: false; error: "validation" | "network" | "server" }
> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { ok: false, error: "validation" };
  }

  try {
    const response = await fetch(`${getApiUrl()}/api/v1/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized }),
    });

    if (response.status === 422) {
      return { ok: false, error: "validation" };
    }

    if (!response.ok) {
      return { ok: false, error: "server" };
    }

    const data = (await response.json()) as WaitlistSubscribeResult;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function confirmWaitlistToken(
  token: string,
): Promise<
  | { ok: true; status: WaitlistActionStatus }
  | { ok: false; error: "invalid_token" | "network" }
> {
  if (!isValidWaitlistToken(token)) {
    return { ok: false, error: "invalid_token" };
  }

  try {
    const response = await fetch(
      `${getApiUrl()}/api/v1/waitlist/confirm/${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    );

    if (response.status === 404) {
      return { ok: false, error: "invalid_token" };
    }

    if (!response.ok) {
      return { ok: false, error: "network" };
    }

    const body = (await response.json()) as { status: WaitlistActionStatus };
    return { ok: true, status: body.status };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function unsubscribeWaitlistToken(
  token: string,
): Promise<
  | { ok: true; status: WaitlistActionStatus }
  | { ok: false; error: "invalid_token" | "network" }
> {
  if (!isValidWaitlistToken(token)) {
    return { ok: false, error: "invalid_token" };
  }

  try {
    const response = await fetch(
      `${getApiUrl()}/api/v1/waitlist/unsubscribe/${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    );

    if (response.status === 404) {
      return { ok: false, error: "invalid_token" };
    }

    if (!response.ok) {
      return { ok: false, error: "network" };
    }

    const body = (await response.json()) as { status: WaitlistActionStatus };
    return { ok: true, status: body.status };
  } catch {
    return { ok: false, error: "network" };
  }
}
