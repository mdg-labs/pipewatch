import { sql } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import type { PipelineConclusion, PipelineStatus } from "@pipewatch/types";

const SPARKLINE_DAYS = 7;
const ACTIVE_STATUSES = ["queued", "in_progress"] as const satisfies readonly PipelineStatus[];

export type RepoHealth = "healthy" | "running" | "failing";

export type DashboardHealthSummary = {
  healthy: number;
  running: number;
  failing: number;
  total: number;
};

export type DashboardLastRun = {
  id: string;
  external_run_id: string;
  pipeline_name: string;
  status: PipelineStatus;
  conclusion: PipelineConclusion;
  branch: string;
  commit_sha: string;
  commit_message: string | null;
  actor_login: string | null;
  trigger_type: string;
  source_url: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

export type DashboardRepoCard = {
  id: string;
  full_name: string;
  integration_id: string;
  is_running: boolean;
  health: RepoHealth;
  last_run: DashboardLastRun | null;
  sparkline: number[];
};

export type WorkspaceDashboard = {
  health: DashboardHealthSummary;
  repos: DashboardRepoCard[];
};

type RepoAggregateRow = {
  repo_id: string;
  full_name: string;
  integration_id: string;
  is_running: boolean;
  last_run_id: string | null;
  external_run_id: string | null;
  pipeline_name: string | null;
  last_run_status: string | null;
  last_run_conclusion: string | null;
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  actor_login: string | null;
  trigger_type: string | null;
  source_url: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  duration_ms: number | null;
};

type SparklineRow = {
  repo_id: string;
  day: string;
  failures: number;
  total: number;
};

function buildSparklineDayKeys(referenceDate = new Date()): string[] {
  const utcMidnight = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  const keys: string[] = [];
  for (let offset = SPARKLINE_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(utcMidnight - offset * 86_400_000);
    keys.push(day.toISOString().slice(0, 10));
  }

  return keys;
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return value.toISOString();
}

function classifyRepoHealth(
  isRunning: boolean,
  lastRunStatus: PipelineStatus | null,
  lastRunConclusion: PipelineConclusion | null,
): RepoHealth {
  if (isRunning) {
    return "running";
  }

  if (lastRunStatus === "completed" && lastRunConclusion === "failure") {
    return "failing";
  }

  return "healthy";
}

function buildLastRun(row: RepoAggregateRow): DashboardLastRun | null {
  if (
    !row.last_run_id ||
    !row.external_run_id ||
    !row.pipeline_name ||
    !row.last_run_status ||
    !row.branch ||
    !row.commit_sha ||
    !row.trigger_type ||
    !row.source_url ||
    !row.started_at
  ) {
    return null;
  }

  return {
    id: row.last_run_id,
    external_run_id: row.external_run_id,
    pipeline_name: row.pipeline_name,
    status: row.last_run_status as PipelineStatus,
    conclusion: row.last_run_conclusion as PipelineConclusion,
    branch: row.branch,
    commit_sha: row.commit_sha,
    commit_message: row.commit_message,
    actor_login: row.actor_login,
    trigger_type: row.trigger_type,
    source_url: row.source_url,
    started_at: toIsoString(row.started_at) ?? "",
    completed_at: toIsoString(row.completed_at),
    duration_ms: row.duration_ms,
  };
}

function failureRatePercent(failures: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((failures / total) * 100);
}

function buildSparklineForRepo(
  repoId: string,
  dayKeys: string[],
  sparklineRows: SparklineRow[],
): number[] {
  const ratesByDay = new Map<string, number>();

  for (const row of sparklineRows) {
    if (row.repo_id !== repoId) {
      continue;
    }

    ratesByDay.set(row.day, failureRatePercent(row.failures, row.total));
  }

  return dayKeys.map((day) => ratesByDay.get(day) ?? 0);
}

/** Aggregate workspace dashboard data with grouped/lateral SQL (pages B3). */
export async function getWorkspaceDashboard(
  database: Db,
  workspaceId: string,
): Promise<WorkspaceDashboard> {
  const dayKeys = buildSparklineDayKeys();
  const sparklineStart = `${dayKeys[0] ?? ""}T00:00:00.000Z`;

  const repoResult = await database.execute<RepoAggregateRow>(sql`
    SELECT
      r.id AS repo_id,
      r.full_name,
      r.integration_id,
      EXISTS (
        SELECT 1
        FROM pipeline_runs pr_active
        WHERE pr_active.repo_id = r.id
          AND pr_active.workspace_id = r.workspace_id
          AND pr_active.status IN (${sql.join(
            ACTIVE_STATUSES.map((status) => sql`${status}`),
            sql`, `,
          )})
      ) AS is_running,
      lr.id AS last_run_id,
      lr.external_run_id,
      lr.pipeline_name,
      lr.status AS last_run_status,
      lr.conclusion AS last_run_conclusion,
      lr.branch,
      lr.commit_sha,
      lr.commit_message,
      lr.actor_login,
      lr.trigger_type,
      lr.source_url,
      lr.started_at,
      lr.completed_at,
      lr.duration_ms
    FROM repositories r
    LEFT JOIN LATERAL (
      SELECT pr.*
      FROM pipeline_runs pr
      WHERE pr.repo_id = r.id
        AND pr.workspace_id = r.workspace_id
      ORDER BY pr.started_at DESC, pr.id DESC
      LIMIT 1
    ) lr ON true
    WHERE r.workspace_id = ${workspaceId}::uuid
      AND r.enabled = true
    ORDER BY r.full_name ASC
  `);

  const sparklineResult = await database.execute<SparklineRow>(sql`
    SELECT
      pr.repo_id,
      to_char(date_trunc('day', pr.started_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE pr.conclusion = 'failure')::int AS failures,
      COUNT(*)::int AS total
    FROM pipeline_runs pr
    WHERE pr.workspace_id = ${workspaceId}::uuid
      AND pr.started_at >= ${sparklineStart}::timestamptz
    GROUP BY pr.repo_id, date_trunc('day', pr.started_at AT TIME ZONE 'UTC')
  `);

  const sparklineRows = [...sparklineResult];
  const repos: DashboardRepoCard[] = [...repoResult].map((row) => {
    const isRunning = Boolean(row.is_running);
    const health = classifyRepoHealth(
      isRunning,
      row.last_run_status as PipelineStatus | null,
      row.last_run_conclusion as PipelineConclusion | null,
    );

    return {
      id: row.repo_id,
      full_name: row.full_name,
      integration_id: row.integration_id,
      is_running: isRunning,
      health,
      last_run: buildLastRun(row),
      sparkline: buildSparklineForRepo(row.repo_id, dayKeys, sparklineRows),
    };
  });

  const health: DashboardHealthSummary = {
    healthy: repos.filter((repo) => repo.health === "healthy").length,
    running: repos.filter((repo) => repo.health === "running").length,
    failing: repos.filter((repo) => repo.health === "failing").length,
    total: repos.length,
  };

  return { health, repos };
}
