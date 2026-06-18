import { describe, expect, it } from "vitest";

import {
  GITHUB_RUNS_SEARCH_CAP,
  MIN_BACKFILL_WINDOW_MS,
  backfillWindowDurationMs,
  bisectBackfillWindow,
  buildInitialBackfillWindow,
  canSubdivideBackfillWindow,
  formatCreatedRangeFilter,
  formatCreatedSinceFilter,
  isWindowAtSearchCap,
  retentionWindowStart,
} from "./backfill.js";

describe("GitHub backfill window helpers", () => {
  const now = new Date("2026-06-18T12:00:00.000Z");

  it("formats created filters for poll and ranged backfill", () => {
    expect(formatCreatedSinceFilter("2026-05-19")).toBe(">=2026-05-19");
    expect(
      formatCreatedRangeFilter(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-02T00:00:00.000Z"),
      ),
    ).toBe("2026-06-01T00:00:00.000Z..2026-06-02T00:00:00.000Z");
  });

  it("builds the initial retention window from midnight UTC", () => {
    const window = buildInitialBackfillWindow(30, now);
    expect(window.start).toBe(retentionWindowStart(30, now).toISOString());
    expect(window.end).toBe(now.toISOString());
  });

  it("detects the GitHub search cap", () => {
    expect(isWindowAtSearchCap(999)).toBe(false);
    expect(isWindowAtSearchCap(GITHUB_RUNS_SEARCH_CAP)).toBe(true);
    expect(isWindowAtSearchCap(2500)).toBe(true);
  });

  it("bisects windows without overlap", () => {
    const window = {
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-02T00:00:00.000Z",
    };
    const [left, right] = bisectBackfillWindow(window);

    expect(Date.parse(left.end)).toBeLessThan(Date.parse(right.start));
    expect(backfillWindowDurationMs(left)).toBeGreaterThan(0);
    expect(backfillWindowDurationMs(right)).toBeGreaterThan(0);
    expect(
      backfillWindowDurationMs(left) + backfillWindowDurationMs(right) + 1,
    ).toBe(backfillWindowDurationMs(window));
  });

  it("allows subdivision above the minimum window span", () => {
    const wide = {
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-03T00:00:00.000Z",
    };
    expect(canSubdivideBackfillWindow(wide)).toBe(true);

    const narrow = {
      start: "2026-06-01T00:00:00.000Z",
      end: new Date(
        Date.parse("2026-06-01T00:00:00.000Z") + MIN_BACKFILL_WINDOW_MS,
      ).toISOString(),
    };
    expect(canSubdivideBackfillWindow(narrow)).toBe(false);
  });
});
