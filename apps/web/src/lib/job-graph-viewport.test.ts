import { describe, expect, it } from "vitest";

import {
  clampZoom,
  computeFitTransform,
  computeResetTransform,
  stepZoom,
  zoomAtPoint,
} from "@/lib/job-graph-viewport";

describe("job-graph-viewport", () => {
  it("clamps zoom within configured bounds", () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(3)).toBe(2);
    expect(clampZoom(1)).toBe(1);
  });

  it("fits graph inside viewport with padding", () => {
    const transform = computeFitTransform(400, 220, 600, 120);

    expect(transform.scale).toBeLessThan(1);
    expect(transform.translateX).toBeGreaterThan(0);
    expect(transform.translateY).toBeGreaterThan(0);
  });

  it("centers graph at 100% zoom", () => {
    const transform = computeResetTransform(400, 220, 300, 100);

    expect(transform.scale).toBe(1);
    expect(transform.translateX).toBe(50);
    expect(transform.translateY).toBe(60);
  });

  it("zooms toward a pointer position", () => {
    const start = { scale: 1, translateX: 0, translateY: 0 };
    const next = zoomAtPoint(start, 1.5, 100, 50);

    expect(next.scale).toBe(1.5);
    expect(next.translateX).toBe(-50);
    expect(next.translateY).toBe(-25);
  });

  it("steps zoom in and out", () => {
    expect(stepZoom(1, "in")).toBeCloseTo(1.1);
    expect(stepZoom(1, "out")).toBeCloseTo(0.9);
  });
});
