import { describe, expect, it } from "vitest";

import {
  computeReconnectDelayMs,
  SSE_RECONNECT_BASE_DELAY_MS,
  SSE_RECONNECT_MAX_DELAY_MS,
} from "./sse-client";

describe("computeReconnectDelayMs", () => {
  it("uses the base delay for the first reconnect attempt", () => {
    expect(computeReconnectDelayMs(1)).toBe(SSE_RECONNECT_BASE_DELAY_MS);
  });

  it("doubles the delay exponentially until capped", () => {
    expect(computeReconnectDelayMs(2)).toBe(SSE_RECONNECT_BASE_DELAY_MS * 2);
    expect(computeReconnectDelayMs(3)).toBe(SSE_RECONNECT_BASE_DELAY_MS * 4);
    expect(computeReconnectDelayMs(6)).toBe(SSE_RECONNECT_MAX_DELAY_MS);
    expect(computeReconnectDelayMs(10)).toBe(SSE_RECONNECT_MAX_DELAY_MS);
  });
});
