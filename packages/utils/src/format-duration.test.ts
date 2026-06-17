import { describe, expect, it } from "vitest";

import { formatDuration } from "./format-duration.js";

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds only", () => {
    expect(formatDuration(48)).toBe("48s");
    expect(formatDuration(1)).toBe("1s");
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats minute durations with optional seconds", () => {
    expect(formatDuration(134)).toBe("2m 14s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(60)).toBe("1m");
  });

  it("formats hour durations with zero-padded minutes", () => {
    expect(formatDuration(3720)).toBe("1h 02m");
    expect(formatDuration(3600)).toBe("1h 00m");
    expect(formatDuration(7260)).toBe("2h 01m");
  });

  it("returns em dash for invalid values", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });

  it("rounds fractional seconds", () => {
    expect(formatDuration(48.4)).toBe("48s");
    expect(formatDuration(48.6)).toBe("49s");
  });
});
