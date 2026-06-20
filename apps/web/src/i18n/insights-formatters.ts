import type { AppLocale } from "./config";
import { defaultLocale } from "./config";
import { formatDateTime, formatNumber } from "./format";
import type { DurationLabels } from "./time-formatters";
import { EN_DURATION_LABELS, formatDurationWithLabels } from "./time-formatters";

export function formatChartDateLabel(
  isoDate: string,
  locale: AppLocale = defaultLocale,
): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return formatDateTime(date, { month: "short", day: "numeric", timeZone: "UTC" }, locale);
}

export function formatInsightsCount(
  value: number,
  locale: AppLocale = defaultLocale,
): string {
  return formatNumber(value, undefined, locale);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatMsAsDuration(
  ms: number | null | undefined,
  labels: DurationLabels = EN_DURATION_LABELS,
): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) {
    return labels.emDash;
  }

  return formatDurationWithLabels(Math.round(ms / 1_000), labels);
}

export function formatDurationAxisLabel(
  ms: number,
  labels: DurationLabels = EN_DURATION_LABELS,
): string {
  const minutes = ms / 60_000;
  if (minutes >= 10) {
    return labels.minutes(Math.round(minutes));
  }

  if (minutes >= 1) {
    return labels.minutes(Number(minutes.toFixed(minutes >= 5 ? 0 : 1)));
  }

  return labels.seconds(Math.round(ms / 1_000));
}

export function buildDurationAxisLabels(
  minMs: number,
  maxMs: number,
  labels: DurationLabels = EN_DURATION_LABELS,
): string[] {
  const steps = [1, 0.75, 0.5, 0.25, 0];
  const range = maxMs - minMs || 1;

  return steps.map((step) => formatDurationAxisLabel(minMs + range * step, labels));
}

export function buildPercentAxisLabels(maxPercent: number): string[] {
  const max = Math.max(maxPercent, 1);
  const steps = [1, 0.75, 0.5, 0.25, 0];

  return steps.map((step) => `${Math.round(max * step)}%`);
}

export function formatSignedPercent(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const absolute = Math.abs(value);
  const formatted = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}%`;
}

export function formatSignedPoints(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const absolute = Math.abs(value);
  const formatted = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted} pts`;
}
