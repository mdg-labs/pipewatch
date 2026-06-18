import type { CSSProperties } from "react";

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface SparklineGeometry {
  linePath: string;
  areaPath: string | null;
  lastPoint: SparklinePoint | null;
}

export interface BuildSparklineGeometryOptions {
  data: number[];
  width: number;
  height: number;
  strokeWidth?: number;
}

/** Build SVG path data for a sparkline from numeric series. */
export function buildSparklineGeometry({
  data,
  width,
  height,
  strokeWidth = 1.5,
}: BuildSparklineGeometryOptions): SparklineGeometry | null {
  if (data.length < 2) {
    return null;
  }

  const pad = strokeWidth + 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points: SparklinePoint[] = data.map((value, index) => ({
    x: pad + (index / (data.length - 1)) * (width - 2 * pad),
    y: height - pad - ((value - min) / range) * (height - 2 * pad),
  }));

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ");

  const last = points[points.length - 1];
  const first = points[0];
  const areaPath =
    last && first
      ? `${linePath} L${last.x.toFixed(1)},${height} L${first.x.toFixed(1)},${height}Z`
      : null;

  return {
    linePath,
    areaPath,
    lastPoint: last ?? null,
  };
}

export interface SparklineProps {
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showArea?: boolean;
  showDot?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Sparkline({
  data = [],
  width = 80,
  height = 24,
  color,
  strokeWidth = 1.5,
  showArea = false,
  showDot = true,
  className,
  style,
}: SparklineProps) {
  const stroke = color ?? "var(--pw-chart-1)";

  if (!data || data.length < 2) {
    return (
      <svg
        className={className}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={style}
        aria-hidden
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border-default)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const geometry = buildSparklineGeometry({
    data,
    width,
    height,
    strokeWidth,
  });

  if (!geometry) {
    return null;
  }

  const { linePath, areaPath, lastPoint } = geometry;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: "visible", display: "block", ...style }}
      aria-hidden
    >
      {showArea && areaPath ? (
        <path d={areaPath} fill={stroke} opacity="0.08" />
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && lastPoint ? (
        <circle
          cx={lastPoint.x.toFixed(1)}
          cy={lastPoint.y.toFixed(1)}
          r={strokeWidth * 2}
          fill={stroke}
        />
      ) : null}
    </svg>
  );
}
