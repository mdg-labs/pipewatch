import { flags } from "@pipewatch/config/edition";

/** Cloud-only workspace switcher — hidden in CE. */
export function isWorkspaceSwitcherEnabled(): boolean {
  return flags.MULTI_WORKSPACE_ENABLED;
}

/** Cloud-only billing nav — hidden in CE. */
export function isBillingNavEnabled(): boolean {
  return flags.BILLING_ENABLED;
}
