import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { pipelineJobs } from "./pipeline-jobs.js";

/**
 * Step within a pipeline job (PRD §6 — Decision #37).
 * No `workspace_id` — steps load in job/run detail context via JOIN.
 *
 * **Cascade:** job delete removes steps.
 */
export const pipelineSteps = pgTable("pipeline_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => pipelineJobs.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  conclusion: text("conclusion"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
});
