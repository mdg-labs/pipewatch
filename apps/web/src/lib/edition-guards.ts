import { flags } from "@pipewatch/config/edition";

/** Cloud-only workspace switcher — hidden in CE (Page Inventory global conventions). */
export function isWorkspaceSwitcherEnabled(): boolean {
  return flags.MULTI_WORKSPACE_ENABLED;
}

/** Cloud-only billing nav and settings route — hidden in CE (B12). */
export function isBillingNavEnabled(): boolean {
  return flags.BILLING_ENABLED;
}

/** Cloud-only waitlist marketing routes (PRD §26). */
export function isWaitlistEnabled(): boolean {
  return flags.WAITLIST_ENABLED;
}

/** CE-only bootstrap `/setup` when no users exist (PRD §26). */
export function isBootstrapEnabled(): boolean {
  return flags.BOOTSTRAP_ENABLED;
}

/** Stripe-backed billing mutations — cloud edition only. */
export function isStripeEnabled(): boolean {
  return flags.STRIPE_ENABLED;
}
