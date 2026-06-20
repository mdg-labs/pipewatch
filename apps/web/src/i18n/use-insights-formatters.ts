"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { AppLocale } from "./config";
import { defaultLocale, isAppLocale } from "./config";
import {
  buildDurationAxisLabels,
  buildPercentAxisLabels,
  formatChartDateLabel,
  formatInsightsCount,
  formatMsAsDuration,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
} from "./insights-formatters";
import { buildDurationLabels } from "./time-formatters";

export function useInsightsFormatters() {
  const localeRaw = useLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : defaultLocale;
  const tDuration = useTranslations("common.duration");

  return useMemo(() => {
    const durationLabels = buildDurationLabels(tDuration);

    return {
      locale,
      emDash: durationLabels.emDash,
      formatChartDate: (isoDate: string) => formatChartDateLabel(isoDate, locale),
      formatCount: (value: number) => formatInsightsCount(value, locale),
      formatPercent,
      formatMsAsDuration: (ms: number | null | undefined) =>
        formatMsAsDuration(ms, durationLabels),
      buildDurationAxisLabels: (minMs: number, maxMs: number) =>
        buildDurationAxisLabels(minMs, maxMs, durationLabels),
      buildPercentAxisLabels,
      formatSignedPercent,
      formatSignedPoints,
    };
  }, [locale, tDuration]);
}
