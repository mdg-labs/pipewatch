/** Semantic chart palette tokens from `tokens/colors.css`. */
export const CHART_COLOR_TOKENS = [
  "var(--pw-chart-1)",
  "var(--pw-chart-2)",
  "var(--pw-chart-3)",
  "var(--pw-chart-4)",
  "var(--pw-chart-5)",
] as const;

export function chartColorForIndex(index: number): string {
  return CHART_COLOR_TOKENS[index % CHART_COLOR_TOKENS.length] ?? "var(--pw-chart-1)";
}
