import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { pipelineRuns } from "./pipeline-runs.js";
import { workspaces } from "./workspaces.js";

/**
 * Job within a pipeline run (PRD §6 — Decision #37).
 * Denormalized `workspace_id` for fast workspace-scoped queries (Decision #31).
 *
 * **Cascade:** workspace or run delete removes jobs (and steps via job FK).
 */
export const pipelineJobs = pgTable(
  "pipeline_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: "cascade" }),
    externalJobId: text("external_job_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    conclusion: text("conclusion"),
    runnerName: text("runner_name"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    unique("pipeline_jobs_run_id_external_job_id_unique").on(
      table.runId,
      table.externalJobId,
    ),
  ],
);
