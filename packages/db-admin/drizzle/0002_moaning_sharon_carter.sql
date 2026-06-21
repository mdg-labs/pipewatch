ALTER TABLE "admin"."webhook_deliveries" ADD COLUMN "first_polled_at" timestamp with time zone;--> statement-breakpoint
UPDATE "admin"."webhook_deliveries" SET "first_polled_at" = "polled_at" WHERE "first_polled_at" IS NULL;--> statement-breakpoint
ALTER TABLE "admin"."webhook_deliveries" ALTER COLUMN "first_polled_at" SET NOT NULL;