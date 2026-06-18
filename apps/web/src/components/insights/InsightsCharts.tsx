"use client";

import type { InsightsRange, InsightsTimeSeriesDay } from "@pipewatch/types";
import {
  DEFAULT_CHART_PADDING,
  TimeSeriesChart,
  chartColorForIndex,
  classNames,
} from "@pipewatch/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  buildDurationAxisLabels,
  buildPercentAxisLabels,
  buildTimeSeriesChartData,
  formatChartDateLabel,
  formatMsAsDuration,
  formatPercent,
  rankWorkflowKeys,
} from "@/lib/insights-utils";

import "./insights.css";

const CHART_HEIGHT = 220;

export type InsightsChartsProps = {
  durationDays: InsightsTimeSeriesDay[];
  failureDays: InsightsTimeSeriesDay[];
  range: InsightsRange;
};

type ChartTooltipState = {
  dayIndex: number;
  clientX: number;
  clientY: number;
};

type InteractiveChartProps = {
  title: string;
  unitLabel: string;
  days: InsightsTimeSeriesDay[];
  valueFormatter: (value: number) => string;
  yAxisBuilder: (min: number, max: number) => string[];
  showArea?: boolean;
};

function InteractiveInsightsChart({
  title,
  unitLabel,
  days,
  valueFormatter,
  yAxisBuilder,
  showArea = false,
}: InteractiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(528);
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setWidth(Math.max(node.clientWidth, 280));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const keys = useMemo(() => rankWorkflowKeys(days), [days]);
  const chartData = useMemo(
    () => buildTimeSeriesChartData(days, keys),
    [days, keys],
  );

  const allValues = chartData.series.flatMap((entry) => entry.data);
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
  const yAxisLabels = yAxisBuilder(minValue, maxValue);

  const padding = DEFAULT_CHART_PADDING;
  const innerWidth = width - padding.left - padding.right;
  const columnWidth = days.length > 0 ? innerWidth / days.length : innerWidth;

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGRectElement>, dayIndex: number) => {
      setTooltip({
        dayIndex,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [],
  );

  const clearTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const tooltipDay = tooltip ? days[tooltip.dayIndex] : null;
  const tooltipPoints =
    tooltipDay && keys.length > 0
      ? keys.map((key, index) => {
          const point = tooltipDay.points.find(
            (entry) => `${entry.repo_id}:${entry.workflow}` === key,
          );

          return {
            key,
            label: chartData.series[index]?.label ?? key,
            color: chartColorForIndex(index),
            value: point?.value ?? 0,
          };
        })
      : [];

  return (
    <section className="pw-insights-chart-card">
      <div className="pw-insights-chart-header">
        <h2 className="pw-insights-chart-title">{title}</h2>
        <span className="pw-insights-chart-unit">{unitLabel}</span>
      </div>

      <div ref={containerRef} className="pw-insights-chart-canvas">
        <TimeSeriesChart
          series={chartData.series}
          labels={chartData.labels}
          width={width}
          height={CHART_HEIGHT}
          yAxisLabels={yAxisLabels}
          showArea={showArea}
          ariaLabel={title}
        />

        {days.length > 0 ? (
          <svg
            className="pw-insights-chart-overlay"
            width={width}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            aria-hidden
          >
            {days.map((day, index) => {
              const x = padding.left + index * columnWidth;
              return (
                <rect
                  key={day.date}
                  x={x}
                  y={padding.top}
                  width={columnWidth}
                  height={CHART_HEIGHT - padding.top - padding.bottom}
                  fill="transparent"
                  onPointerMove={(event) => handlePointerMove(event, index)}
                  onPointerLeave={clearTooltip}
                />
              );
            })}
          </svg>
        ) : null}

        {tooltip && tooltipDay ? (
          <div
            className="pw-insights-chart-tooltip"
            style={{
              left: tooltip.clientX,
              top: tooltip.clientY,
            }}
            role="tooltip"
          >
            <div className="pw-insights-chart-tooltip-date">
              {formatChartDateLabel(tooltipDay.date)}
            </div>
            {tooltipPoints.length > 0 ? (
              <ul className="pw-insights-chart-tooltip-list">
                {tooltipPoints.map((point) => (
                  <li key={point.key}>
                    <span
                      className="pw-insights-chart-tooltip-swatch"
                      style={{ backgroundColor: point.color }}
                      aria-hidden
                    />
                    <span className="pw-insights-chart-tooltip-label">{point.label}</span>
                    <span className="pw-insights-chart-tooltip-value">
                      {valueFormatter(point.value)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pw-insights-chart-tooltip-empty">No data</p>
            )}
          </div>
        ) : null}
      </div>

      {chartData.series.length > 0 ? (
        <ul className="pw-insights-chart-legend" aria-label={`${title} legend`}>
          {chartData.series.map((entry, index) => (
            <li key={entry.id}>
              <span
                className="pw-insights-chart-legend-swatch"
                style={{ backgroundColor: chartColorForIndex(index) }}
                aria-hidden
              />
              <span>{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function InsightsCharts({ durationDays, failureDays, range }: InsightsChartsProps) {
  return (
    <div
      className={classNames(
        "pw-insights-charts-grid",
        range === "30d" && "pw-insights-charts-grid-wide",
      )}
    >
      <InteractiveInsightsChart
        title="Duration over time"
        unitLabel="minutes"
        days={durationDays}
        valueFormatter={(value) => formatMsAsDuration(value)}
        yAxisBuilder={buildDurationAxisLabels}
      />
      <InteractiveInsightsChart
        title="Failure rate over time"
        unitLabel="percent"
        days={failureDays}
        valueFormatter={(value) => formatPercent(value)}
        yAxisBuilder={(_min, max) => buildPercentAxisLabels(max)}
        showArea
      />
    </div>
  );
}
