import type { PipelineConclusion, PipelineStatus } from "@pipewatch/types";

/** GitHub Actions status strings PipeWatch recognizes (jobs, runs, steps). */
export const KNOWN_GITHUB_STATUSES = new Set([
  "queued",
  "waiting",
  "requested",
  "pending",
  "in_progress",
  "completed",
]);

export type MapGitHubStatusOptions = {
  /** Invoked when `status` is not a known GitHub Actions status string. */
  onUnknown?: (status: string) => void;
};

/** Returns whether `status` is a known GitHub Actions status string. */
export function isKnownGitHubStatus(status: string): boolean {
  return KNOWN_GITHUB_STATUSES.has(status);
}

/**
 * Map GitHub Actions status strings to canonical pipeline status.
 * Unknown values map to `in_progress` (never `completed`) so UI cannot show false success.
 */
export function mapGitHubStatus(
  status: string,
  options?: MapGitHubStatusOptions,
): PipelineStatus {
  switch (status) {
    case "queued":
    case "waiting":
    case "requested":
    case "pending":
      return "queued";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    default:
      options?.onUnknown?.(status);
      return "in_progress";
  }
}

/** Map GitHub Actions conclusion to canonical pipeline conclusion. */
export function mapGitHubConclusion(
  conclusion: string | null | undefined,
  status: string,
): PipelineConclusion {
  if (status !== "completed") {
    return null;
  }

  if (!conclusion) {
    return null;
  }

  switch (conclusion) {
    case "success":
      return "success";
    case "failure":
      return "failure";
    case "cancelled":
      return "cancelled";
    case "skipped":
      return "skipped";
    case "timed_out":
      return "failure";
    case "action_required":
    case "neutral":
    case "stale":
      return "failure";
    default:
      return "failure";
  }
}

/** Parse ISO-8601 timestamp; throws on invalid input. */
export function parseGitHubTimestamp(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid GitHub timestamp: ${value}`);
  }
  return date;
}

/** Compute duration in milliseconds when both endpoints are known. */
export function computeDurationMs(
  startedAt: Date,
  completedAt: Date | null,
): number | null {
  if (!completedAt) {
    return null;
  }
  return completedAt.getTime() - startedAt.getTime();
}
