ALTER TABLE "notification_outbox" DROP CONSTRAINT "notification_outbox_kind_check";--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "classification" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "template_version" smallint;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "template_key" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "render_inputs" jsonb;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "correlation_id" text;--> statement-breakpoint
UPDATE "notification_outbox"
SET
	"classification" = 'TENANT_FINANCIAL',
	"template_version" = 1,
	"template_key" = 'ORDER_COMPLETED',
	"render_inputs" = '{}'::jsonb,
	"correlation_id" = 'legacy_' || replace("id"::text, '-', ''),
	"status" = CASE
		WHEN "status" IN ('PENDING', 'SENDING', 'RETRY') THEN 'SKIPPED'
		ELSE "status"
	END,
	"last_error_code" = CASE
		WHEN "status" IN ('PENDING', 'SENDING', 'RETRY') THEN 'LEGACY_PLAINTEXT_REDACTED'
		ELSE "last_error_code"
	END,
	"updated_at" = CASE
		WHEN "status" IN ('PENDING', 'SENDING', 'RETRY') THEN now()
		ELSE "updated_at"
	END;--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "classification" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "template_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "template_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "render_inputs" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "correlation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_outbox" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "notification_outbox" DROP COLUMN "message";--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_classification_check" CHECK ("notification_outbox"."classification" = 'TENANT_FINANCIAL');--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_template_check" CHECK ("notification_outbox"."template_version" = 1 AND "notification_outbox"."template_key" IN ('RISK_REJECTED', 'ORDER_PENDING', 'ORDER_COMPLETED', 'DAILY_DIGEST'));--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_render_inputs_check" CHECK (jsonb_typeof("notification_outbox"."render_inputs") = 'object' AND octet_length("notification_outbox"."render_inputs"::text) <= 4096);--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_correlation_id_check" CHECK ("notification_outbox"."correlation_id" ~ '^[A-Za-z0-9_-]{8,80}$');
