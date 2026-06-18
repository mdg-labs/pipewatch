import * as Sentry from "@sentry/nextjs";

/** Initialize Sentry when `SENTRY_DSN` is set — no-op otherwise. */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  const release = process.env.SENTRY_RELEASE;
  const environment =
    process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;

  Sentry.init({
    dsn,
    ...(release ? { release } : {}),
    ...(environment ? { environment } : {}),
  });
}
