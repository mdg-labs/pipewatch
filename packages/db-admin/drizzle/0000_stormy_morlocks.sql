CREATE SCHEMA "admin";
--> statement-breakpoint
CREATE TABLE "admin"."admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin"."admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin"."admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "admin"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin"."webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_delivery_id" text NOT NULL,
	"github_guid" text NOT NULL,
	"external_installation_id" text,
	"integration_id" uuid,
	"workspace_id" uuid,
	"event" text NOT NULL,
	"action" text,
	"status_code" integer NOT NULL,
	"status" text NOT NULL,
	"duration" real,
	"redelivery" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp with time zone NOT NULL,
	"polled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_github_delivery_id_unique" UNIQUE("github_delivery_id")
);
--> statement-breakpoint
ALTER TABLE "admin"."admin_invites" ADD CONSTRAINT "admin_invites_invited_by_admin_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "admin"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin"."admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "admin"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin"."audit_events" ADD CONSTRAINT "audit_events_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "admin"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_workspace_id_delivered_at_idx" ON "admin"."webhook_deliveries" USING btree ("workspace_id","delivered_at" desc);--> statement-breakpoint
CREATE INDEX "webhook_deliveries_external_installation_id_delivered_at_idx" ON "admin"."webhook_deliveries" USING btree ("external_installation_id","delivered_at" desc);--> statement-breakpoint
CREATE INDEX "webhook_deliveries_delivered_at_idx" ON "admin"."webhook_deliveries" USING btree ("delivered_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_failures_idx" ON "admin"."webhook_deliveries" USING btree ("status_code","delivered_at" desc) WHERE "admin"."webhook_deliveries"."status_code" = 0 OR "admin"."webhook_deliveries"."status_code" >= 300;