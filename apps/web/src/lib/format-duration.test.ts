import { describe, expect, it } from "vitest";

import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  it("delegates to shared duration labels", () => {
    expect(formatDuration(48)).toBe("48s");
    expect(formatDuration(134)).toBe("2m 14s");
    expect(formatDuration(3720)).toBe("1h 02m");
    expect(formatDuration(null)).toBe("—");
  });
});
