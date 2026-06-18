CREATE TABLE "pipeline_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"external_job_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"conclusion" text,
	"runner_name" text,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	CONSTRAINT "pipeline_jobs_run_id_external_job_id_unique" UNIQUE("run_id","external_job_id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"external_run_id" text NOT NULL,
	"pipeline_name" text NOT NULL,
	"pipeline_definition_ref" text NOT NULL,
	"status" text NOT NULL,
	"conclusion" text,
	"branch" text NOT NULL,
	"commit_sha" text NOT NULL,
	"commit_message" text,
	"actor_login" text,
	"trigger_type" text NOT NULL,
	"source_url" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_runs_repo_id_external_run_id_unique" UNIQUE("repo_id","external_run_id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"conclusion" text,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_steps" ADD CONSTRAINT "pipeline_steps_job_id_pipeline_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."pipeline_jobs"("id") ON DELETE cascade ON UPDATE no action;