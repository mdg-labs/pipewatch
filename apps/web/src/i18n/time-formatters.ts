export type DurationLabels = {
  emDash: string;
  zero: string;
  seconds: (seconds: number) => string;
  minutes: (minutes: number) => string;
  minutesSeconds: (minutes: number, seconds: number) => string;
  hoursMinutes: (hours: number, minutes: string) => string;
};

export type RelativeTimeLabels = {
  emDash: string;
  justNow: string;
  secondsAgo: (count: number) => string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  daysAgo: (count: number) => string;
  elapsed: (minutes: number, seconds: string) => string;
};

type DurationTranslator = (
  key: "emDash" | "zero" | "seconds" | "minutes" | "minutesSeconds" | "hoursMinutes",
  values?: Record<string, string | number>,
) => string;

type RelativeTimeTranslator = (
  key:
    | "emDash"
    | "justNow"
    | "secondsAgo"
    | "minutesAgo"
    | "hoursAgo"
    | "daysAgo"
    | "elapsed",
  values?: Record<string, string | number>,
) => string;

export const EN_DURATION_LABELS: DurationLabels = {
  emDash: "—",
  zero: "0s",
  seconds: (seconds) => `${seconds}s`,
  minutes: (minutes) => `${minutes}m`,
  minutesSeconds: (minutes, seconds) => `${minutes}m ${seconds}s`,
  hoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
};

export const EN_RELATIVE_TIME_LABELS: RelativeTimeLabels = {
  emDash: "—",
  justNow: "just now",
  secondsAgo: (count) => `${count}s ago`,
  minutesAgo: (count) => `${count} min ago`,
  hoursAgo: (count) => `${count} hour${count === 1 ? "" : "s"} ago`,
  daysAgo: (count) => `${count} day${count === 1 ? "" : "s"} ago`,
  elapsed: (minutes, seconds) => `${minutes}m ${seconds}s`,
};

export function buildDurationLabels(t: DurationTranslator): DurationLabels {
  return {
    emDash: t("emDash"),
    zero: t("zero"),
    seconds: (seconds) => t("seconds", { seconds }),
    minutes: (minutes) => t("minutes", { minutes }),
    minutesSeconds: (minutes, seconds) => t("minutesSeconds", { minutes, seconds }),
    hoursMinutes: (hours, minutes) => t("hoursMinutes", { hours, minutes }),
  };
}

export function buildRelativeTimeLabels(t: RelativeTimeTranslator): RelativeTimeLabels {
  return {
    emDash: t("emDash"),
    justNow: t("justNow"),
    secondsAgo: (count) => t("secondsAgo", { count }),
    minutesAgo: (count) => t("minutesAgo", { count }),
    hoursAgo: (count) => t("hoursAgo", { count }),
    daysAgo: (count) => t("daysAgo", { count }),
    elapsed: (minutes, seconds) => t("elapsed", { minutes, seconds }),
  };
}

/** Format a duration in seconds for dashboard and run UI. */
export function formatDurationWithLabels(
  totalSeconds: number | null | undefined,
  labels: DurationLabels = EN_DURATION_LABELS,
): string {
  if (
    totalSeconds == null ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return labels.emDash;
  }

  const seconds = Math.round(totalSeconds);

  if (seconds === 0) {
    return labels.zero;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return labels.hoursMinutes(hours, String(minutes).padStart(2, "0"));
  }

  if (minutes > 0) {
    if (remainingSeconds > 0) {
      return labels.minutesSeconds(minutes, remainingSeconds);
    }
    return labels.minutes(minutes);
  }

  return labels.seconds(remainingSeconds);
}

export function formatRelativeTimeWithLabels(
  iso: string | null | undefined,
  labels: RelativeTimeLabels = EN_RELATIVE_TIME_LABELS,
): string {
  if (!iso) {
    return labels.emDash;
  }

  const deltaMs = Date.now() - new Date(iso).getTime();
  const deltaSeconds = Math.round(deltaMs / 1_000);

  if (deltaSeconds < 60) {
    return deltaSeconds <= 5 ? labels.justNow : labels.secondsAgo(deltaSeconds);
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return labels.minutesAgo(deltaMinutes);
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return labels.hoursAgo(deltaHours);
  }

  const deltaDays = Math.round(deltaHours / 24);
  return labels.daysAgo(deltaDays);
}

export function formatElapsedSinceWithLabels(
  iso: string,
  labels: RelativeTimeLabels = EN_RELATIVE_TIME_LABELS,
): string {
  const deltaMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const totalSeconds = Math.floor(deltaMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return labels.elapsed(minutes, seconds.toString().padStart(2, "0"));
}
