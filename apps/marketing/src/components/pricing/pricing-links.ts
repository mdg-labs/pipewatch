import { flags } from "@pipewatch/config/edition";

import { getAppUrl, isWaitlistMode } from "@/lib/env";

import type { PlanId } from "./pricing-content";

/** Plan CTA destination — waitlist (pre-launch) or cloud signup with plan preselected (live). */
export function getPlanCtaUrl(planId: PlanId): string {
  if (isWaitlistMode() && flags.WAITLIST_ENABLED) {
    return `/waitlist?plan=${planId}`;
  }
  return `${getAppUrl()}/sign-up?plan=${planId}`;
}
