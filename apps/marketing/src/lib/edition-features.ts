import { flags } from "@pipewatch/config/edition";

/** Cloud-only Umami analytics — no-op in CE. */
export function isUmamiEnabled(): boolean {
  return flags.UMAMI_ENABLED;
}

/** Cloud-only waitlist CTA — no-op in CE when disabled. */
export function isWaitlistEnabled(): boolean {
  return flags.WAITLIST_ENABLED;
}
