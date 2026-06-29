export const JOB_GRAPH_VIEWPORT_HEIGHT = 220;
export const JOB_GRAPH_ZOOM_MIN = 0.25;
export const JOB_GRAPH_ZOOM_MAX = 2;
export const JOB_GRAPH_ZOOM_STEP = 0.1;
export const JOB_GRAPH_FIT_PADDING = 16;

export type ViewportTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export function clampZoom(scale: number): number {
  return Math.min(JOB_GRAPH_ZOOM_MAX, Math.max(JOB_GRAPH_ZOOM_MIN, scale));
}

export function computeFitTransform(
  viewportWidth: number,
  viewportHeight: number,
  graphWidth: number,
  graphHeight: number,
  padding = JOB_GRAPH_FIT_PADDING,
): ViewportTransform {
  if (graphWidth <= 0 || graphHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }

  const availableWidth = Math.max(0, viewportWidth - padding * 2);
  const availableHeight = Math.max(0, viewportHeight - padding * 2);
  const scale = clampZoom(
    Math.min(availableWidth / graphWidth, availableHeight / graphHeight),
  );

  return {
    scale,
    translateX: (viewportWidth - graphWidth * scale) / 2,
    translateY: (viewportHeight - graphHeight * scale) / 2,
  };
}

export function computeResetTransform(
  viewportWidth: number,
  viewportHeight: number,
  graphWidth: number,
  graphHeight: number,
): ViewportTransform {
  return {
    scale: 1,
    translateX: (viewportWidth - graphWidth) / 2,
    translateY: (viewportHeight - graphHeight) / 2,
  };
}

/** Zoom toward a pointer position in viewport coordinates. */
export function zoomAtPoint(
  transform: ViewportTransform,
  nextScale: number,
  pointerX: number,
  pointerY: number,
): ViewportTransform {
  const scale = clampZoom(nextScale);
  const ratio = scale / transform.scale;

  return {
    scale,
    translateX: pointerX - ratio * (pointerX - transform.translateX),
    translateY: pointerY - ratio * (pointerY - transform.translateY),
  };
}

export function stepZoom(scale: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? JOB_GRAPH_ZOOM_STEP : -JOB_GRAPH_ZOOM_STEP;
  return clampZoom(scale + delta);
}
