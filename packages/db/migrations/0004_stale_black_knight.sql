CREATE TABLE "telegram_login_presentations" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"telegram_user_id" text NOT NULL,
	"auth_date" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telegram_login_presentations_expires_at_idx" ON "telegram_login_presentations" USING btree ("expires_at");