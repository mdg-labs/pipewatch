import { and, desc, eq, gte, lt, lte, or, type SQL } from "drizzle-orm";

import type { Db } from "@pipewatch/db";
import { pipelineRuns, repositories } from "@pipewatch/db/schema";
import type {
  ListPipelineRunsQuery,
  PaginatedPipelineRuns,
  PipelineRun,
  PipelineStatus,
} from "@pipewatch/types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class PipelineRunError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PipelineRunError";
    this.status = status;
    this.code = code;
  }
}

type RunCursor = {
  startedAt: string;
  id: string;
};

function toPipelineRun(row: typeof pipelineRuns.$inferSelect): PipelineRun {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    repo_id: row.repoId,
    external_run_id: row.externalRunId,
    pipeline_name: row.pipelineName,
    pipeline_definition_ref: row.pipelineDefinitionRef,
    status: row.status as PipelineStatus,
    conclusion: row.conclusion as PipelineRun["conclusion"],
    branch: row.branch,
    commit_sha: row.commitSha,
    commit_message: row.commitMessage,
    actor_login: row.actorLogin,
    trigger_type: row.triggerType,
    source_url: row.sourceUrl,
    started_at: row.startedAt.toISOString(),
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    duration_ms: row.durationMs,
    created_at: row.createdAt.toISOString(),
  };
}

function encodeCursor(cursor: RunCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): RunCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as RunCursor;

    if (
      typeof parsed.startedAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.startedAt))
    ) {
      throw new Error("Invalid cursor");
    }

    return parsed;
  } catch {
    throw new PipelineRunError("Invalid pagination cursor", 422, "VALIDATION_ERROR");
  }
}

function resolvePageSize(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new PipelineRunError("page_size must be a positive integer", 422, "VALIDATION_ERROR");
  }

  return Math.min(value, MAX_PAGE_SIZE);
}

function buildListConditions(
  workspaceId: string,
  repoId: string,
  query: ListPipelineRunsQuery,
): SQL[] {
  const conditions: SQL[] = [
    eq(pipelineRuns.workspaceId, workspaceId),
    eq(pipelineRuns.repoId, repoId),
  ];

  if (query.branch !== undefined) {
    conditions.push(eq(pipelineRuns.branch, query.branch));
  }

  if (query.workflow !== undefined) {
    conditions.push(eq(pipelineRuns.pipelineName, query.workflow));
  }

  if (query.status !== undefined) {
    conditions.push(eq(pipelineRuns.status, query.status));
  }

  if (query.trigger !== undefined) {
    conditions.push(eq(pipelineRuns.triggerType, query.trigger));
  }

  if (query.started_from !== undefined) {
    const startedFrom = new Date(query.started_from);
    if (Number.isNaN(startedFrom.getTime())) {
      throw new PipelineRunError("started_from must be a valid datetime", 422, "VALIDATION_ERROR");
    }

    conditions.push(gte(pipelineRuns.startedAt, startedFrom));
  }

  if (query.started_to !== undefined) {
    const startedTo = new Date(query.started_to);
    if (Number.isNaN(startedTo.getTime())) {
      throw new PipelineRunError("started_to must be a valid datetime", 422, "VALIDATION_ERROR");
    }

    conditions.push(lte(pipelineRuns.startedAt, startedTo));
  }

  if (query.cursor !== undefined) {
    const cursor = decodeCursor(query.cursor);
    const cursorDate = new Date(cursor.startedAt);

    conditions.push(
      or(
        lt(pipelineRuns.startedAt, cursorDate),
        and(eq(pipelineRuns.startedAt, cursorDate), lt(pipelineRuns.id, cursor.id)),
      )!,
    );
  }

  return conditions;
}

async function assertRepositoryInWorkspace(
  database: Db,
  workspaceId: string,
  repoId: string,
): Promise<void> {
  const [row] = await database
    .select({ id: repositories.id })
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.id, repoId)))
    .limit(1);

  if (!row) {
    throw new PipelineRunError("Repository not found", 404, "NOT_FOUND");
  }
}

/** Paginated pipeline runs for a workspace repository (PRD §7, pages B4). */
export async function listWorkspacePipelineRuns(
  database: Db,
  workspaceId: string,
  repoId: string,
  query: ListPipelineRunsQuery = {},
): Promise<PaginatedPipelineRuns> {
  await assertRepositoryInWorkspace(database, workspaceId, repoId);

  const pageSize = resolvePageSize(query.page_size);
  const rows = await database
    .select()
    .from(pipelineRuns)
    .where(and(...buildListConditions(workspaceId, repoId, query)))
    .orderBy(desc(pipelineRuns.startedAt), desc(pipelineRuns.id))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = pageRows.at(-1);

  return {
    data: pageRows.map((row) => toPipelineRun(row)),
    cursor:
      hasMore && lastRow
        ? encodeCursor({ startedAt: lastRow.startedAt.toISOString(), id: lastRow.id })
        : null,
    hasMore,
  };
}

/** Fetch a single pipeline run with full B6 header fields. */
export async function getWorkspacePipelineRun(
  database: Db,
  workspaceId: string,
  repoId: string,
  runId: string,
): Promise<PipelineRun | null> {
  await assertRepositoryInWorkspace(database, workspaceId, repoId);

  const [row] = await database
    .select()
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.workspaceId, workspaceId),
        eq(pipelineRuns.repoId, repoId),
        eq(pipelineRuns.id, runId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return toPipelineRun(row);
}

/** Delete a pipeline run (admin manual purge — PRD §7). */
export async function deleteWorkspacePipelineRun(
  database: Db,
  workspaceId: string,
  repoId: string,
  runId: string,
): Promise<void> {
  await assertRepositoryInWorkspace(database, workspaceId, repoId);

  const [deleted] = await database
    .delete(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.workspaceId, workspaceId),
        eq(pipelineRuns.repoId, repoId),
        eq(pipelineRuns.id, runId),
      ),
    )
    .returning({ id: pipelineRuns.id });

  if (!deleted) {
    throw new PipelineRunError("Pipeline run not found", 404, "NOT_FOUND");
  }
}

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
