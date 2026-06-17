import { describe, expect, it } from "vitest";

import {
  buildBarChartGeometry,
  buildTimeSeriesGeometry,
  chartColorForIndex,
} from "./index.js";

describe("chartColorForIndex", () => {
  it("cycles through semantic chart color tokens", () => {
    expect(chartColorForIndex(0)).toBe("var(--pw-chart-1)");
    expect(chartColorForIndex(4)).toBe("var(--pw-chart-5)");
    expect(chartColorForIndex(5)).toBe("var(--pw-chart-1)");
  });
});

describe("buildTimeSeriesGeometry", () => {
  it("returns null when fewer than two data points", () => {
    expect(
      buildTimeSeriesGeometry({ data: [], width: 528, height: 180 }),
    ).toBeNull();
    expect(
      buildTimeSeriesGeometry({ data: [4], width: 528, height: 180 }),
    ).toBeNull();
  });

  it("builds line and area paths for a series", () => {
    const geometry = buildTimeSeriesGeometry({
      data: [1, 3, 2, 5],
      width: 528,
      height: 180,
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.linePath).toMatch(/^M[\d.]+,[\d.]+(?: L[\d.]+,[\d.]+)+$/);
    expect(geometry?.areaPath).toContain("Z");
    expect(geometry?.lastPoint).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });
});

describe("buildBarChartGeometry", () => {
  it("returns null for empty data", () => {
    expect(
      buildBarChartGeometry({ data: [], width: 560, height: 180 }),
    ).toBeNull();
  });

  it("builds stacked bar rectangles", () => {
    const geometry = buildBarChartGeometry({
      data: [
        { label: "Mon", values: [8, 2] },
        { label: "Tue", values: [6, 1] },
      ],
      width: 560,
      height: 180,
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.bars.length).toBe(4);
    expect(geometry?.maxValue).toBe(10);
    expect(geometry?.bars[0]).toEqual(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
        seriesIndex: 0,
      }),
    );
  });
});
