import { describe, expect, it } from "vitest";

import { buildSparklineGeometry } from "./components/sparkline.js";

describe("buildSparklineGeometry", () => {
  it("returns null when fewer than two data points", () => {
    expect(
      buildSparklineGeometry({ data: [], width: 80, height: 24 }),
    ).toBeNull();
    expect(
      buildSparklineGeometry({ data: [5], width: 80, height: 24 }),
    ).toBeNull();
  });

  it("builds line and area paths for a series", () => {
    const geometry = buildSparklineGeometry({
      data: [1, 3, 2, 5],
      width: 80,
      height: 24,
      strokeWidth: 1.5,
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.linePath).toMatch(/^M[\d.]+,[\d.]+(?: L[\d.]+,[\d.]+)+$/);
    expect(geometry?.areaPath).toContain("Z");
    expect(geometry?.lastPoint).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });

  it("handles flat series without dividing by zero", () => {
    const geometry = buildSparklineGeometry({
      data: [4, 4, 4],
      width: 80,
      height: 20,
    });

    expect(geometry?.linePath).toMatch(/^M/);
    expect(geometry?.lastPoint).not.toBeNull();
  });
});
