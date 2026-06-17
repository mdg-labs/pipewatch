import type { PipelineConclusion, PipelineStatus } from "@pipewatch/types";

/** Map GitHub Actions status strings to canonical pipeline status. */
export function mapGitHubStatus(status: string): PipelineStatus {
  switch (status) {
    case "queued":
    case "waiting":
    case "requested":
    case "pending":
      return "queued";
    case "in_progress":
      return "in_progress";
    default:
      return "completed";
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
