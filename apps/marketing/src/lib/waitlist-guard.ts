import { redirect } from "next/navigation";

import { flags } from "@pipewatch/config/edition";

import { getMarketingEnv } from "./env";

/** Redirect away when waitlist routes are unavailable (A5, A7). */
export function assertWaitlistRouteAccessible(): void {
  if (!flags.WAITLIST_ENABLED || getMarketingEnv().LAUNCH_MODE === "live") {
    redirect("/");
  }
}
