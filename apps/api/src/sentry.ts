import * as Sentry from "@sentry/node";

/** Initialize Sentry when `SENTRY_DSN` is set — no-op otherwise. */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({ dsn });
}
