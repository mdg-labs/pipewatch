import type { LiveConnectionStatus } from "@/components/app-shell/LiveIndicator";

/** Aggregate per-repo SSE statuses for the dashboard live badge (PRD §19, B3). */
export function aggregateLiveStatus(
  statuses: readonly LiveConnectionStatus[],
): LiveConnectionStatus {
  if (statuses.length === 0) {
    return "offline";
  }

  if (statuses.some((status) => status === "connected")) {
    return "connected";
  }

  if (statuses.some((status) => status === "reconnecting")) {
    return "reconnecting";
  }

  if (statuses.some((status) => status === "connecting")) {
    return "connecting";
  }

  return "offline";
}
