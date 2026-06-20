"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  buildDurationLabels,
  buildRelativeTimeLabels,
  formatDurationWithLabels,
  formatElapsedSinceWithLabels,
  formatRelativeTimeWithLabels,
} from "./time-formatters";

export function useTimeFormatters() {
  const tDuration = useTranslations("common.duration");
  const tRelative = useTranslations("common.relativeTime");

  return useMemo(() => {
    const durationLabels = buildDurationLabels(tDuration);
    const relativeLabels = buildRelativeTimeLabels(tRelative);

    return {
      formatDuration: (totalSeconds: number | null | undefined) =>
        formatDurationWithLabels(totalSeconds, durationLabels),
      formatRelativeTime: (iso: string | null | undefined) =>
        formatRelativeTimeWithLabels(iso, relativeLabels),
      formatElapsedSince: (iso: string) => formatElapsedSinceWithLabels(iso, relativeLabels),
      emDash: durationLabels.emDash,
    };
  }, [tDuration, tRelative]);
}
