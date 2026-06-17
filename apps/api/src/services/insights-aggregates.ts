import { sql } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import type {
  InsightsMostFailingWorkflow,
  InsightsQuery,
  InsightsRange,
  InsightsSlowestWorkflow,
  InsightsSummary,
  InsightsTimeSeries,
  InsightsTimeSeriesDay,
  WorkspaceInsights,
} from "@pipewatch/types";

const RANGE_DAYS: Record<InsightsRange, number> = {
  "7d": 7,
  "30d": 30,
};

type RangeBounds = {
  start: Date;
  end: Date;
  previousStart: Date;
  dayKeys: string[];
};

type FilterClause = ReturnType<typeof sql>;

type SummaryRow = {
  total_runs: number;
  completed_runs: number;
  success_runs: number;
  avg_duration_ms: number | null;
};

type MostActiveRepoRow = {
  repo_id: string;
  full_name: string;
  run_count: number;
};

type TimeSeriesRow = {
  day: string;
  pipeline_name: string;
  repo_id: string;
  repo_full_name: string;
  avg_duration_ms: number | null;
  failures: number;
  total: number;
};

type WorkflowDurationRow = {
  pipeline_name: string;
  repo_id: string;
  repo_full_name: string;
  avg_duration_ms: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  run_count: number;
};

type WorkflowFailureRow = {
  pipeline_name: string;
  repo_id: string;
  repo_full_name: string;
  failure_count: number;
  run_count: number;
};

function buildDayKeys(referenceDate: Date, days: number): string[] {
  const utcMidnight = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(utcMidnight - offset * 86_400_000);
    keys.push(day.toISOString().slice(0, 10));
  }

  return keys;
}

function resolveRangeBounds(range: InsightsRange, referenceDate = new Date()): RangeBounds {
  const days = RANGE_DAYS[range];
  const end = referenceDate;
  const start = new Date(end.getTime() - days * 86_400_000);
  const previousStart = new Date(start.getTime() - days * 86_400_000);

  return {
    start,
    end,
    previousStart,
    dayKeys: buildDayKeys(referenceDate, days),
  };
}

function buildPeriodFilters(
  workspaceId: string,
  query: InsightsQuery,
  periodStart: Date,
  periodEnd: Date,
): FilterClause {
  const parts: FilterClause[] = [
    sql`pr.workspace_id = ${workspaceId}::uuid`,
    sql`pr.started_at >= ${periodStart.toISOString()}::timestamptz`,
    sql`pr.started_at < ${periodEnd.toISOString()}::timestamptz`,
  ];

  if (query.repoId) {
    parts.push(sql`pr.repo_id = ${query.repoId}::uuid`);
  }

  if (query.workflow) {
    parts.push(sql`pr.pipeline_name = ${query.workflow}`);
  }

  return sql.join(parts, sql` AND `);
}

function successRatePercent(successRuns: number, completedRuns: number): number {
  if (completedRuns === 0) {
    return 0;
  }

  return Math.round((successRuns / completedRuns) * 100);
}

function failureRatePercent(failures: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((failures / total) * 100);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function pointsChange(current: number, previous: number): number | null {
  return Math.round((current - previous) * 10) / 10;
}

function workflowKey(repoId: string, workflow: string): string {
  return `${repoId}:${workflow}`;
}

function emptyInsights(range: InsightsRange): WorkspaceInsights {
  return {
    range,
    summary: {
      total_runs: 0,
      success_rate: 0,
      avg_duration_ms: null,
      most_active_repo: null,
      trends: {
        total_runs_percent: null,
        success_rate_points: null,
        avg_duration_percent: null,
      },
    },
    time_series: {
      duration: [],
      failure_rate: [],
    },
    slowest_workflows: [],
    most_failing_workflows: [],
  };
}

function buildTimeSeries(
  dayKeys: string[],
  rows: TimeSeriesRow[],
): InsightsTimeSeries {
  const durationByDay = new Map<string, InsightsTimeSeriesDay["points"]>();
  const failureByDay = new Map<string, InsightsTimeSeriesDay["points"]>();

  for (const row of rows) {
    const durationPoints = durationByDay.get(row.day) ?? [];
    if (row.avg_duration_ms !== null) {
      durationPoints.push({
        workflow: row.pipeline_name,
        repo_id: row.repo_id,
        repo_full_name: row.repo_full_name,
        value: Math.round(row.avg_duration_ms),
      });
    }
    durationByDay.set(row.day, durationPoints);

    const failurePoints = failureByDay.get(row.day) ?? [];
    failurePoints.push({
      workflow: row.pipeline_name,
      repo_id: row.repo_id,
      repo_full_name: row.repo_full_name,
      value: failureRatePercent(row.failures, row.total),
    });
    failureByDay.set(row.day, failurePoints);
  }

  return {
    duration: dayKeys.map((date) => ({
      date,
      points: durationByDay.get(date) ?? [],
    })),
    failure_rate: dayKeys.map((date) => ({
      date,
      points: failureByDay.get(date) ?? [],
    })),
  };
}

async function fetchSummaryRow(
  database: Db,
  whereClause: FilterClause,
): Promise<SummaryRow> {
  const result = await database.execute<SummaryRow>(sql`
    SELECT
      COUNT(*)::int AS total_runs,
      COUNT(*) FILTER (WHERE pr.status = 'completed')::int AS completed_runs,
      COUNT(*) FILTER (WHERE pr.conclusion = 'success')::int AS success_runs,
      AVG(pr.duration_ms) FILTER (
        WHERE pr.status = 'completed' AND pr.duration_ms IS NOT NULL
      )::float AS avg_duration_ms
    FROM pipeline_runs pr
    WHERE ${whereClause}
  `);

  const row = result[0];
  return {
    total_runs: row?.total_runs ?? 0,
    completed_runs: row?.completed_runs ?? 0,
    success_runs: row?.success_runs ?? 0,
    avg_duration_ms: row?.avg_duration_ms ?? null,
  };
}

async function fetchMostActiveRepo(
  database: Db,
  whereClause: FilterClause,
): Promise<MostActiveRepoRow | null> {
  const result = await database.execute<MostActiveRepoRow>(sql`
    SELECT
      r.id AS repo_id,
      r.full_name,
      COUNT(*)::int AS run_count
    FROM pipeline_runs pr
    INNER JOIN repositories r ON r.id = pr.repo_id
    WHERE ${whereClause}
    GROUP BY r.id, r.full_name
    ORDER BY run_count DESC, r.full_name ASC
    LIMIT 1
  `);

  return result[0] ?? null;
}

async function fetchTimeSeriesRows(
  database: Db,
  whereClause: FilterClause,
): Promise<TimeSeriesRow[]> {
  const result = await database.execute<TimeSeriesRow>(sql`
    SELECT
      to_char(date_trunc('day', pr.started_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      pr.pipeline_name,
      pr.repo_id,
      r.full_name AS repo_full_name,
      AVG(pr.duration_ms) FILTER (
        WHERE pr.status = 'completed' AND pr.duration_ms IS NOT NULL
      )::float AS avg_duration_ms,
      COUNT(*) FILTER (WHERE pr.conclusion = 'failure')::int AS failures,
      COUNT(*) FILTER (WHERE pr.status = 'completed')::int AS total
    FROM pipeline_runs pr
    INNER JOIN repositories r ON r.id = pr.repo_id
    WHERE ${whereClause}
    GROUP BY
      date_trunc('day', pr.started_at AT TIME ZONE 'UTC'),
      pr.pipeline_name,
      pr.repo_id,
      r.full_name
    ORDER BY day ASC, pr.pipeline_name ASC
  `);

  return [...result];
}

async function fetchWorkflowDurations(
  database: Db,
  whereClause: FilterClause,
): Promise<WorkflowDurationRow[]> {
  const result = await database.execute<WorkflowDurationRow>(sql`
    SELECT
      pr.pipeline_name,
      pr.repo_id,
      r.full_name AS repo_full_name,
      AVG(pr.duration_ms)::float AS avg_duration_ms,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY pr.duration_ms)::float AS p50_duration_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY pr.duration_ms)::float AS p95_duration_ms,
      COUNT(*)::int AS run_count
    FROM pipeline_runs pr
    INNER JOIN repositories r ON r.id = pr.repo_id
    WHERE ${whereClause}
      AND pr.status = 'completed'
      AND pr.duration_ms IS NOT NULL
    GROUP BY pr.pipeline_name, pr.repo_id, r.full_name
    ORDER BY avg_duration_ms DESC NULLS LAST, pr.pipeline_name ASC
    LIMIT 10
  `);

  return [...result];
}

async function fetchWorkflowFailures(
  database: Db,
  whereClause: FilterClause,
): Promise<WorkflowFailureRow[]> {
  const result = await database.execute<WorkflowFailureRow>(sql`
    SELECT
      pr.pipeline_name,
      pr.repo_id,
      r.full_name AS repo_full_name,
      COUNT(*) FILTER (WHERE pr.conclusion = 'failure')::int AS failure_count,
      COUNT(*)::int AS run_count
    FROM pipeline_runs pr
    INNER JOIN repositories r ON r.id = pr.repo_id
    WHERE ${whereClause}
      AND pr.status = 'completed'
    GROUP BY pr.pipeline_name, pr.repo_id, r.full_name
    HAVING COUNT(*) FILTER (WHERE pr.conclusion = 'failure') > 0
    ORDER BY
      (COUNT(*) FILTER (WHERE pr.conclusion = 'failure')::float / COUNT(*)::float) DESC,
      failure_count DESC,
      pr.pipeline_name ASC
    LIMIT 10
  `);

  return [...result];
}

/** Aggregate workspace insights for the requested range and filters (PRD §12.5). */
export async function getWorkspaceInsights(
  database: Db,
  workspaceId: string,
  query: InsightsQuery,
): Promise<WorkspaceInsights> {
  const bounds = resolveRangeBounds(query.range);
  const currentWhere = buildPeriodFilters(workspaceId, query, bounds.start, bounds.end);
  const previousWhere = buildPeriodFilters(
    workspaceId,
    query,
    bounds.previousStart,
    bounds.start,
  );

  const [
    currentSummary,
    previousSummary,
    mostActiveRepo,
    timeSeriesRows,
    slowestCurrent,
    slowestPrevious,
    failingCurrent,
    failingPrevious,
  ] = await Promise.all([
    fetchSummaryRow(database, currentWhere),
    fetchSummaryRow(database, previousWhere),
    fetchMostActiveRepo(database, currentWhere),
    fetchTimeSeriesRows(database, currentWhere),
    fetchWorkflowDurations(database, currentWhere),
    fetchWorkflowDurations(database, previousWhere),
    fetchWorkflowFailures(database, currentWhere),
    fetchWorkflowFailures(database, previousWhere),
  ]);

  if (currentSummary.total_runs === 0) {
    return emptyInsights(query.range);
  }

  const previousDurationByWorkflow = new Map(
    slowestPrevious.map((row) => [
      workflowKey(row.repo_id, row.pipeline_name),
      row.avg_duration_ms,
    ]),
  );
  const previousFailureRateByWorkflow = new Map(
    failingPrevious.map((row) => [
      workflowKey(row.repo_id, row.pipeline_name),
      failureRatePercent(row.failure_count, row.run_count),
    ]),
  );

  const summary: InsightsSummary = {
    total_runs: currentSummary.total_runs,
    success_rate: successRatePercent(
      currentSummary.success_runs,
      currentSummary.completed_runs,
    ),
    avg_duration_ms:
      currentSummary.avg_duration_ms === null
        ? null
        : Math.round(currentSummary.avg_duration_ms),
    most_active_repo: mostActiveRepo
      ? {
          repo_id: mostActiveRepo.repo_id,
          full_name: mostActiveRepo.full_name,
          run_count: mostActiveRepo.run_count,
        }
      : null,
    trends: {
      total_runs_percent: percentChange(
        currentSummary.total_runs,
        previousSummary.total_runs,
      ),
      success_rate_points: pointsChange(
        successRatePercent(currentSummary.success_runs, currentSummary.completed_runs),
        successRatePercent(previousSummary.success_runs, previousSummary.completed_runs),
      ),
      avg_duration_percent:
        currentSummary.avg_duration_ms !== null && previousSummary.avg_duration_ms !== null
          ? percentChange(
              Math.round(currentSummary.avg_duration_ms),
              Math.round(previousSummary.avg_duration_ms),
            )
          : null,
    },
  };

  const slowest_workflows: InsightsSlowestWorkflow[] = slowestCurrent.map((row) => {
    const previousAvg = previousDurationByWorkflow.get(
      workflowKey(row.repo_id, row.pipeline_name),
    );

    return {
      workflow: row.pipeline_name,
      repo_id: row.repo_id,
      repo_full_name: row.repo_full_name,
      avg_duration_ms:
        row.avg_duration_ms === null ? null : Math.round(row.avg_duration_ms),
      p50_duration_ms:
        row.p50_duration_ms === null ? null : Math.round(row.p50_duration_ms),
      p95_duration_ms:
        row.p95_duration_ms === null ? null : Math.round(row.p95_duration_ms),
      run_count: row.run_count,
      trend_percent:
        row.avg_duration_ms !== null && previousAvg !== null && previousAvg !== undefined
          ? percentChange(Math.round(row.avg_duration_ms), Math.round(previousAvg))
          : null,
    };
  });

  const most_failing_workflows: InsightsMostFailingWorkflow[] = failingCurrent.map((row) => {
    const currentRate = failureRatePercent(row.failure_count, row.run_count);
    const previousRate = previousFailureRateByWorkflow.get(
      workflowKey(row.repo_id, row.pipeline_name),
    );

    return {
      workflow: row.pipeline_name,
      repo_id: row.repo_id,
      repo_full_name: row.repo_full_name,
      failure_rate: currentRate,
      failure_count: row.failure_count,
      run_count: row.run_count,
      trend_percent:
        previousRate !== undefined ? pointsChange(currentRate, previousRate) : null,
    };
  });

  return {
    range: query.range,
    summary,
    time_series: buildTimeSeries(bounds.dayKeys, timeSeriesRows),
    slowest_workflows,
    most_failing_workflows,
  };
}
