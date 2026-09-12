ALTER TABLE "api_sessions" ADD COLUMN "correlation_id" text;--> statement-breakpoint
CREATE INDEX "api_sessions_correlation_id_idx" ON "api_sessions" USING btree ("correlation_id");--> statement-breakpoint
ALTER TABLE "api_sessions" ADD CONSTRAINT "api_sessions_correlation_id_check" CHECK ("api_sessions"."correlation_id" IS NULL OR "api_sessions"."correlation_id" ~ '^[A-Za-z0-9_-]{8,80}$');