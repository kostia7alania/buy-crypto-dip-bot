CREATE TABLE "telegram_login_abuse_limits" (
	"abuse_key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_login_abuse_limits_key_check" CHECK ("telegram_login_abuse_limits"."abuse_key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "telegram_login_abuse_limits_attempt_count_check" CHECK ("telegram_login_abuse_limits"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "telegram_login_abuse_limits_updated_at_idx" ON "telegram_login_abuse_limits" USING btree ("updated_at");