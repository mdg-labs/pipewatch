import type { CSSProperties } from "react";

import { classNames } from "../lib/class-names.js";
import { chartColorForIndex } from "../lib/chart-colors.js";

import {
  DEFAULT_CHART_PADDING,
  type ChartPadding,
} from "./time-series-chart.js";

export interface BarChartDatum {
  label: string;
  values: number[];
}

export interface BarChartSeries {
  id: string;
  label: string;
  color?: string;
}

export interface BarChartBarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  seriesIndex: number;
}

export interface BuildBarChartGeometryOptions {
  data: BarChartDatum[];
  width: number;
  height: number;
  padding?: ChartPadding;
  barGap?: number;
}

export interface BarChartGeometry {
  bars: BarChartBarGeometry[];
  maxValue: number;
}

/** Build bar rectangles for a stacked bar chart. */
export function buildBarChartGeometry({
  data,
  width,
  height,
  padding = DEFAULT_CHART_PADDING,
  barGap = 3,
}: BuildBarChartGeometryOptions): BarChartGeometry | null {
  if (data.length === 0) {
    return null;
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const totals = data.map((datum) =>
    datum.values.reduce((sum, value) => sum + value, 0),
  );
  const maxValue = Math.max(...totals, 1);
  const bandWidth = innerWidth / data.length;
  const barWidth = Math.max(bandWidth - barGap * 2, 1);
  const bars: BarChartBarGeometry[] = [];

  data.forEach((datum, datumIndex) => {
    const x = padding.left + datumIndex * bandWidth + barGap;
    let stackedHeight = 0;

    datum.values.forEach((value, seriesIndex) => {
      if (value <= 0) {
        return;
      }

      const barHeight = (value / maxValue) * innerHeight;
      const y = padding.top + innerHeight - stackedHeight - barHeight;
      bars.push({
        x,
        y,
        width: barWidth,
        height: barHeight,
        seriesIndex,
      });
      stackedHeight += barHeight;
    });
  });

  return { bars, maxValue };
}

export interface BarChartProps {
  data: BarChartDatum[];
  series: BarChartSeries[];
  width?: number;
  height?: number;
  padding?: ChartPadding;
  showGrid?: boolean;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function barChartClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-chart", className);
}

/** Stacked bar chart for insights — uses semantic chart color tokens. */
export function BarChart({
  data,
  series,
  width = 560,
  height = 180,
  padding = DEFAULT_CHART_PADDING,
  showGrid = true,
  animate = true,
  className,
  style,
  ariaLabel = "Bar chart",
}: BarChartProps) {
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const geometry = buildBarChartGeometry({ data, width, height, padding });
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const bandWidth = data.length > 0 ? innerWidth / data.length : 0;

  if (!geometry) {
    return (
      <svg
        className={barChartClassName({ className })}
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
      className={barChartClassName({ className })}
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

      {data.map((datum, index) =>
        index % 2 === 0 ? (
          <text
            key={datum.label}
            x={padding.left + (index + 0.5) * bandWidth}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="var(--text-tertiary)"
            fontFamily="var(--font-sans)"
          >
            {datum.label}
          </text>
        ) : null,
      )}

      {geometry.bars.map((bar, index) => {
        const entry = series[bar.seriesIndex];
        const color = entry?.color ?? chartColorForIndex(bar.seriesIndex);
        const barClass = animate ? "pw-chart-bar-grow" : undefined;

        return (
          <rect
            key={`${bar.seriesIndex}-${index}`}
            className={barClass}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={color}
            opacity={bar.seriesIndex === 0 ? 0.55 : 0.75}
            rx="2"
            aria-label={entry?.label}
          />
        );
      })}
    </svg>
  );
}
