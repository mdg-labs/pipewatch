import { flags } from "@pipewatch/config/edition";

/** Cloud-only queue workers — not started in CE. */
export function registerCloudWorkers(): void {
  if (!flags.PLAN_LIMITS_ENABLED) {
    return;
  }
}
