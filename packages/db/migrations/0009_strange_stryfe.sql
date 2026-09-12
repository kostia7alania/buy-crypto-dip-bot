ALTER TABLE "audit_events" ADD COLUMN "schema_version" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_kind" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_channel" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_user_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "payload_class" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_scope_user_created_at_idx" ON "audit_events" USING btree ("scope","user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "schema_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_v1_envelope_check" CHECK ("audit_events"."schema_version" = 0 OR (
        "audit_events"."schema_version" = 1
        AND "audit_events"."scope" IS NOT NULL
        AND "audit_events"."scope" IN ('USER', 'SYSTEM')
        AND (
          ("audit_events"."scope" = 'USER' AND "audit_events"."user_id" IS NOT NULL)
          OR ("audit_events"."scope" = 'SYSTEM' AND "audit_events"."user_id" IS NULL)
        )
        AND "audit_events"."actor_kind" IS NOT NULL
        AND "audit_events"."actor_kind" IN ('USER', 'SYSTEM', 'ANONYMOUS')
        AND "audit_events"."actor_channel" IS NOT NULL
        AND "audit_events"."actor_channel" IN ('WEB', 'TELEGRAM', 'API', 'RUNNER', 'MIGRATOR')
        AND (
          ("audit_events"."actor_kind" = 'USER' AND "audit_events"."actor_user_id" IS NOT NULL AND "audit_events"."actor_user_id" = "audit_events"."user_id")
          OR ("audit_events"."actor_kind" IN ('SYSTEM', 'ANONYMOUS') AND "audit_events"."actor_user_id" IS NULL)
        )
        AND "audit_events"."reason_code" IS NOT NULL
        AND "audit_events"."correlation_id" IS NOT NULL
        AND "audit_events"."correlation_id" ~ '^[A-Za-z0-9_-]{8,80}$'
        AND "audit_events"."payload_class" IS NOT NULL
        AND "audit_events"."payload_class" IN ('SECURITY', 'TENANT_CONFIGURATION', 'TENANT_FINANCIAL', 'OPERATIONAL')
        AND jsonb_typeof("audit_events"."payload") = 'object'
        AND octet_length("audit_events"."payload"::text) <= 8192
      ));--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.schema_version = 1 THEN
    RAISE EXCEPTION 'AUDIT_EVENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
