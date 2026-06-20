import { EN_DURATION_LABELS, formatDurationWithLabels } from "@/i18n/time-formatters";

/** Format a duration in seconds for dashboard UI (matches @pipewatch/utils voice rules). */
export function formatDuration(totalSeconds: number | null | undefined): string {
  return formatDurationWithLabels(totalSeconds, EN_DURATION_LABELS);
}
