import type { CSSProperties } from "react";

import { classNames } from "../lib/class-names.js";
import { chartColorForIndex } from "../lib/chart-colors.js";

export interface TimeSeriesPoint {
  x: number;
  y: number;
}

export interface TimeSeriesSeries {
  id: string;
  label: string;
  data: number[];
  color?: string;
}

export interface BuildTimeSeriesGeometryOptions {
  data: number[];
  width: number;
  height: number;
  padding?: ChartPadding;
  minValue?: number;
  maxValue?: number;
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TimeSeriesGeometry {
  linePath: string;
  areaPath: string | null;
  points: TimeSeriesPoint[];
  lastPoint: TimeSeriesPoint | null;
}

export const DEFAULT_CHART_PADDING: ChartPadding = {
  top: 14,
  right: 10,
  bottom: 32,
  left: 30,
};

function innerDimensions(
  width: number,
  height: number,
  padding: ChartPadding,
): { innerWidth: number; innerHeight: number } {
  return {
    innerWidth: width - padding.left - padding.right,
    innerHeight: height - padding.top - padding.bottom,
  };
}

/** Build SVG path data for a time-series line from numeric values. */
export function buildTimeSeriesGeometry({
  data,
  width,
  height,
  padding = DEFAULT_CHART_PADDING,
  minValue,
  maxValue,
}: BuildTimeSeriesGeometryOptions): TimeSeriesGeometry | null {
  if (data.length < 2) {
    return null;
  }

  const { innerWidth, innerHeight } = innerDimensions(width, height, padding);
  const min = minValue ?? Math.min(...data);
  const max = maxValue ?? Math.max(...data);
  const range = max - min || 1;

  const points: TimeSeriesPoint[] = data.map((value, index) => ({
    x: padding.left + (index / (data.length - 1)) * innerWidth,
    y: padding.top + innerHeight * (1 - (value - min) / range),
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
      ? `${linePath} L${last.x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} L${first.x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)}Z`
      : null;

  return {
    linePath,
    areaPath,
    points,
    lastPoint: last ?? null,
  };
}

export interface TimeSeriesChartProps {
  series: TimeSeriesSeries[];
  labels?: string[];
  width?: number;
  height?: number;
  padding?: ChartPadding;
  showGrid?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  yAxisLabels?: string[];
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function timeSeriesChartClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-chart", className);
}

/** Multi-series line chart for insights — uses semantic chart color tokens. */
export function TimeSeriesChart({
  series,
  labels = [],
  width = 528,
  height = 180,
  padding = DEFAULT_CHART_PADDING,
  showGrid = true,
  showDots = true,
  showArea = false,
  yAxisLabels = [],
  animate = true,
  className,
  style,
  ariaLabel = "Time series chart",
}: TimeSeriesChartProps) {
  const { innerWidth, innerHeight } = innerDimensions(width, height, padding);
  const allValues = series.flatMap((entry) => entry.data);
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  if (series.length === 0 || series.every((entry) => entry.data.length < 2)) {
    return (
      <svg
        className={timeSeriesChartClassName({ className })}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={style}
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={padding.left}
          y1={padding.top + innerHeight / 2}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight / 2}
          stroke="var(--border-default)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  return (
    <svg
      className={timeSeriesChartClassName({ className })}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      {showGrid
        ? gridSteps.map((step) => {
            const y = padding.top + innerHeight * (1 - step);
            return (
              <line
                key={step}
                x1={padding.left}
                y1={y}
                x2={padding.left + innerWidth}
                y2={y}
                stroke="var(--border-subtle)"
                strokeWidth="1"
                strokeDasharray={step === 0 ? "0" : "4 3"}
              />
            );
          })
        : null}

      {yAxisLabels.map((label, index) => {
        const step = gridSteps[index];
        if (step === undefined) {
          return null;
        }

        const y = padding.top + innerHeight * (1 - step);
        return (
          <text
            key={label}
            x={padding.left - 6}
            y={y + 4}
            textAnchor="end"
            fontSize="9"
            fill="var(--text-tertiary)"
            fontFamily="var(--font-mono)"
          >
            {label}
          </text>
        );
      })}

      {labels.map((label, index) => {
        if (labels.length < 2) {
          return null;
        }

        const x = padding.left + (index / (labels.length - 1)) * innerWidth;
        return (
          <text
            key={`${label}-${index}`}
            x={x}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="var(--text-tertiary)"
            fontFamily="var(--font-sans)"
          >
            {label}
          </text>
        );
      })}

      {series.map((entry, seriesIndex) => {
        const color = entry.color ?? chartColorForIndex(seriesIndex);
        const geometry = buildTimeSeriesGeometry({
          data: entry.data,
          width,
          height,
          padding,
          minValue,
          maxValue,
        });

        if (!geometry) {
          return null;
        }

        const lineClass = animate ? "pw-chart-line-draw" : undefined;

        return (
          <g key={entry.id} aria-label={entry.label}>
            {showArea && geometry.areaPath ? (
              <path d={geometry.areaPath} fill={color} opacity="0.08" />
            ) : null}
            <path
              className={lineClass}
              d={geometry.linePath}
              fill="none"
              stroke={color}
              strokeWidth={seriesIndex === 0 ? 2 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={seriesIndex === 0 ? 1 : 0.75}
            />
            {showDots && geometry.lastPoint ? (
              <circle
                cx={geometry.lastPoint.x.toFixed(1)}
                cy={geometry.lastPoint.y.toFixed(1)}
                r={seriesIndex === 0 ? 3.5 : 2.5}
                fill={color}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
