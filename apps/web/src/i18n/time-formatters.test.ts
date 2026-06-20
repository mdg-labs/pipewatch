import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { defaultLocale } from "./config";
import en from "./locales/en.json";
import {
  EN_DURATION_LABELS,
  EN_RELATIVE_TIME_LABELS,
  buildDurationLabels,
  buildRelativeTimeLabels,
  formatDurationWithLabels,
  formatElapsedSinceWithLabels,
  formatRelativeTimeWithLabels,
} from "./time-formatters";
import { formatTriggerLabel } from "./trigger-labels";

describe("time formatters", () => {
  it("formats durations with English labels", () => {
    expect(formatDurationWithLabels(48, EN_DURATION_LABELS)).toBe("48s");
    expect(formatDurationWithLabels(134, EN_DURATION_LABELS)).toBe("2m 14s");
    expect(formatDurationWithLabels(3720, EN_DURATION_LABELS)).toBe("1h 02m");
    expect(formatDurationWithLabels(null, EN_DURATION_LABELS)).toBe("—");
  });

  it("formats relative time with English labels", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatRelativeTimeWithLabels("2026-06-20T11:59:57.000Z", EN_RELATIVE_TIME_LABELS)).toBe(
      "just now",
    );
    expect(formatRelativeTimeWithLabels("2026-06-20T11:59:00.000Z", EN_RELATIVE_TIME_LABELS)).toBe(
      "1 min ago",
    );

    vi.useRealTimers();
  });

  it("formats elapsed durations", () => {
    const now = new Date("2026-06-20T12:02:05.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatElapsedSinceWithLabels("2026-06-20T12:00:03.000Z", EN_RELATIVE_TIME_LABELS)).toBe(
      "2m 02s",
    );

    vi.useRealTimers();
  });

  it("builds labels from the next-intl catalog", () => {
    const tDuration = createTranslator({
      locale: defaultLocale,
      messages: en,
      namespace: "common.duration",
    });
    const tRelative = createTranslator({
      locale: defaultLocale,
      messages: en,
      namespace: "common.relativeTime",
    });

    const durationLabels = buildDurationLabels(tDuration);
    const relativeLabels = buildRelativeTimeLabels(tRelative);

    expect(formatDurationWithLabels(60, durationLabels)).toBe("1m");
    expect(relativeLabels.emDash).toBe("—");
  });
});

describe("trigger labels", () => {
  const t = createTranslator({
    locale: defaultLocale,
    messages: en,
    namespace: "runs.triggers",
  });

  it("maps known trigger types from the catalog", () => {
    expect(formatTriggerLabel("push", t)).toBe("Push");
    expect(formatTriggerLabel("pull_request", t)).toBe("Pull request");
  });

  it("title-cases unknown trigger types", () => {
    expect(formatTriggerLabel("custom_event")).toBe("Custom Event");
  });
});
