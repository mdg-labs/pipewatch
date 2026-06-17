import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { repositories } from "./repositories.js";
import { workspaces } from "./workspaces.js";

/**
 * CI pipeline run (PRD §6 — Decision #37).
 * Denormalized `workspace_id` for fast workspace-scoped queries (Decision #31).
 *
 * **Cascade:** workspace or repository delete removes runs (and jobs/steps via run FK).
 */
export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    externalRunId: text("external_run_id").notNull(),
    pipelineName: text("pipeline_name").notNull(),
    pipelineDefinitionRef: text("pipeline_definition_ref").notNull(),
    status: text("status").notNull(),
    conclusion: text("conclusion"),
    branch: text("branch").notNull(),
    commitSha: text("commit_sha").notNull(),
    commitMessage: text("commit_message"),
    actorLogin: text("actor_login"),
    triggerType: text("trigger_type").notNull(),
    sourceUrl: text("source_url").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("pipeline_runs_repo_id_external_run_id_unique").on(
      table.repoId,
      table.externalRunId,
    ),
  ],
);
