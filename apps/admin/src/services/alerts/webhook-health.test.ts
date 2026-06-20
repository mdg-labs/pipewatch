import { describe, expect, it } from "vitest";

import {
  AlertRateLimiter,
  findUnreachableSpikes,
  isElevatedFailureRate,
  isNonSuccessStatusCode,
  isUnreachableSpike,
  summarizeDeliveryWindow,
  type DeliveryWindowRow,
} from "./webhook-health.js";

describe("isNonSuccessStatusCode", () => {
  it("treats 2xx as success", () => {
    expect(isNonSuccessStatusCode(200)).toBe(false);
    expect(isNonSuccessStatusCode(299)).toBe(false);
  });

  it("treats 0 and non-2xx as non-success", () => {
    expect(isNonSuccessStatusCode(0)).toBe(true);
    expect(isNonSuccessStatusCode(404)).toBe(true);
    expect(isNonSuccessStatusCode(500)).toBe(true);
    expect(isNonSuccessStatusCode(301)).toBe(true);
  });
});

describe("summarizeDeliveryWindow", () => {
  it("counts non-success and unreachable deliveries", () => {
    const rows: DeliveryWindowRow[] = [
      { statusCode: 200, externalInstallationId: "1" },
      { statusCode: 404, externalInstallationId: "1" },
      { statusCode: 0, externalInstallationId: "2" },
      { statusCode: 0, externalInstallationId: "2" },
    ];

    expect(summarizeDeliveryWindow(rows)).toEqual({
      total: 4,
      nonSuccessCount: 3,
      unreachableCount: 2,
    });
  });
});

describe("isElevatedFailureRate", () => {
  it("returns false on empty windows", () => {
    expect(
      isElevatedFailureRate(
        { total: 0, nonSuccessCount: 0, unreachableCount: 0 },
        0.05,
      ),
    ).toBe(false);
  });

  it("uses strict greater-than threshold (Admin PRD default 5%)", () => {
    expect(
      isElevatedFailureRate(
        { total: 100, nonSuccessCount: 5, unreachableCount: 0 },
        0.05,
      ),
    ).toBe(false);

    expect(
      isElevatedFailureRate(
        { total: 100, nonSuccessCount: 6, unreachableCount: 0 },
        0.05,
      ),
    ).toBe(true);
  });
});

describe("isUnreachableSpike", () => {
  it("matches Admin PRD default threshold of 3", () => {
    expect(isUnreachableSpike(2, 3)).toBe(false);
    expect(isUnreachableSpike(3, 3)).toBe(true);
  });
});

describe("findUnreachableSpikes", () => {
  it("detects global and per-installation spikes", () => {
    const rows: DeliveryWindowRow[] = [
      { statusCode: 0, externalInstallationId: "111" },
      { statusCode: 0, externalInstallationId: "111" },
      { statusCode: 0, externalInstallationId: "222" },
      { statusCode: 200, externalInstallationId: "333" },
    ];

    const spikes = findUnreachableSpikes(rows, 3);
    expect(spikes).toEqual([
      { scope: "global", externalInstallationId: null, count: 3 },
    ]);
  });

  it("prefers a global spike when failures are spread across installations", () => {
    const rows: DeliveryWindowRow[] = [
      { statusCode: 0, externalInstallationId: "111" },
      { statusCode: 0, externalInstallationId: "111" },
      { statusCode: 0, externalInstallationId: "222" },
      { statusCode: 0, externalInstallationId: "222" },
      { statusCode: 200, externalInstallationId: "333" },
    ];

    expect(findUnreachableSpikes(rows, 3)).toEqual([
      { scope: "global", externalInstallationId: null, count: 4 },
    ]);
  });

  it("does not alert when unreachable counts stay below threshold", () => {
    const rows: DeliveryWindowRow[] = [
      { statusCode: 0, externalInstallationId: "111" },
      { statusCode: 0, externalInstallationId: "111" },
      { statusCode: 200, externalInstallationId: "222" },
    ];

    expect(findUnreachableSpikes(rows, 3)).toEqual([]);
  });
});

describe("AlertRateLimiter", () => {
  it("deduplicates alerts within the cooldown window", () => {
    const limiter = new AlertRateLimiter();
    const now = 1_000_000;

    expect(limiter.shouldSend("failure_rate:global", 60_000, now)).toBe(true);
    expect(limiter.shouldSend("failure_rate:global", 60_000, now + 1)).toBe(
      false,
    );
    expect(limiter.shouldSend("failure_rate:global", 60_000, now + 60_000)).toBe(
      true,
    );
  });

  it("tracks fingerprints independently", () => {
    const limiter = new AlertRateLimiter();
    const now = 1_000_000;

    expect(limiter.shouldSend("unreachable:global", 60_000, now)).toBe(true);
    expect(
      limiter.shouldSend("unreachable:installation:42", 60_000, now),
    ).toBe(true);
  });
});
