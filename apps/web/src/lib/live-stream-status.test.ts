import { describe, expect, it } from "vitest";

import { aggregateLiveStatus } from "./live-stream-status";

describe("aggregateLiveStatus", () => {
  it("returns offline when no repos are tracked", () => {
    expect(aggregateLiveStatus([])).toBe("offline");
  });

  it("returns connected when at least one repo is connected", () => {
    expect(aggregateLiveStatus(["reconnecting", "connected", "offline"])).toBe("connected");
    expect(aggregateLiveStatus(["connecting", "connected"])).toBe("connected");
  });

  it("returns reconnecting only when no repo is connected", () => {
    expect(aggregateLiveStatus(["reconnecting", "offline", "connecting"])).toBe("reconnecting");
  });

  it("returns connecting when repos are still opening and none failed", () => {
    expect(aggregateLiveStatus(["connecting", "offline"])).toBe("connecting");
    expect(aggregateLiveStatus(["connecting", "connecting"])).toBe("connecting");
  });

  it("returns offline when every repo is offline", () => {
    expect(aggregateLiveStatus(["offline", "offline"])).toBe("offline");
  });
});
