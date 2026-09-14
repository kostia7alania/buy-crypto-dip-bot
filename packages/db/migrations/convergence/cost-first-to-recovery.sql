-- Source: exact cost-first catalog at becc46b. Run inside the guarded transaction.
-- Never guess owners or enable delivery based on imported profile data.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM strategies s JOIN tenants t ON t.id=s.tenant_id
            WHERE t.kind <> 'personal' OR t.personal_owner_user_id IS NULL
               OR (s.user_id IS NOT NULL AND s.user_id <> t.personal_owner_user_id))
 OR EXISTS (SELECT 1 FROM orders o JOIN tenants t ON t.id=o.tenant_id
            WHERE t.kind <> 'personal' OR o.strategy_id IS NULL)
 THEN RAISE EXCEPTION 'CONVERGENCE_OWNER_DECISION_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM users u WHERE NOT EXISTS
            (SELECT 1 FROM auth_identities i WHERE i.user_id=u.id AND i.provider='telegram'))
 THEN RAISE EXCEPTION 'CONVERGENCE_TELEGRAM_IDENTITY_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM users u JOIN auth_identities i ON i.user_id=u.id AND i.provider='telegram'
            WHERE u.telegram_user_id IS NOT NULL AND u.telegram_user_id <> i.subject)
 THEN RAISE EXCEPTION 'CONVERGENCE_IDENTITY_MISMATCH'; END IF;
END $$;
--> statement-breakpoint
--> statement-breakpoint
UPDATE users u SET telegram_user_id=i.subject,
 username=COALESCE(u.username, i.profile->>'username'),
 first_name=COALESCE(u.first_name, i.profile->>'firstName')
FROM auth_identities i WHERE i.user_id=u.id AND i.provider='telegram';
--> statement-breakpoint
ALTER TABLE users ALTER COLUMN telegram_user_id SET NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "api_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "api_sessions" ADD CONSTRAINT "api_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_sessions_token_hash_idx" ON "api_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_sessions_user_id_idx" ON "api_sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_user_id_created_at_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_strategy_id_idx" ON "orders" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategies_user_id_idx" ON "strategies" USING btree ("user_id");
--> statement-breakpoint
--> statement-breakpoint
UPDATE strategies s SET user_id=t.personal_owner_user_id FROM tenants t WHERE t.id=s.tenant_id;
--> statement-breakpoint
UPDATE orders o SET user_id=t.personal_owner_user_id FROM tenants t WHERE t.id=o.tenant_id;
--> statement-breakpoint
-- Only the newly introduced owner metadata is populated. Original audit fields stay unchanged.
UPDATE audit_events a SET user_id=t.personal_owner_user_id FROM tenants t WHERE t.id=a.tenant_id AND t.kind='personal';
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0003_unusual_blue_shield.sql; does not rewrite its journal.
-- Gate 1 ownership contract. This migration is the authoritative catalog
-- transition after the deliberate legacy backfill and verification steps in
-- migrations/manual. It also runs on a clean install, where the preflight is
-- naturally empty.
DO $$
DECLARE
  ownerless_strategies bigint;
  ownerless_orders bigint;
  orders_without_strategy bigint;
  mismatched_orders bigint;
  orphaned_orders bigint;
  duplicate_strategies bigint;
  invalid_strategy_modes bigint;
  invalid_order_modes bigint;
BEGIN
  SELECT count(*) INTO ownerless_strategies
    FROM strategies WHERE user_id IS NULL;
  SELECT count(*) INTO ownerless_orders
    FROM orders WHERE user_id IS NULL;
  SELECT count(*) INTO orders_without_strategy
    FROM orders WHERE strategy_id IS NULL;
  SELECT count(*) INTO mismatched_orders
    FROM orders o
    JOIN strategies s ON o.strategy_id = s.id
    WHERE o.user_id IS DISTINCT FROM s.user_id;
  SELECT count(*) INTO orphaned_orders
    FROM orders o
    WHERE o.strategy_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM strategies s WHERE s.id = o.strategy_id);
  SELECT coalesce(sum(c - 1), 0) INTO duplicate_strategies
    FROM (
      SELECT count(*) AS c
      FROM strategies
      WHERE user_id IS NOT NULL
      GROUP BY user_id, symbol
      HAVING count(*) > 1
    ) AS dupes;
  SELECT count(*) INTO invalid_strategy_modes
    FROM strategies WHERE mode <> 'DRY_RUN';
  SELECT count(*) INTO invalid_order_modes
    FROM orders WHERE mode <> 'DRY_RUN';

  IF ownerless_strategies > 0
    OR ownerless_orders > 0
    OR orders_without_strategy > 0
    OR mismatched_orders > 0
    OR orphaned_orders > 0
    OR duplicate_strategies > 0
    OR invalid_strategy_modes > 0
    OR invalid_order_modes > 0
  THEN
    RAISE EXCEPTION
      'OWNERSHIP_CONTRACT_PREFLIGHT_FAILED: ownerless_strategies=%, ownerless_orders=%, orders_without_strategy=%, mismatched_orders=%, orphaned_orders=%, duplicate_strategies=%, invalid_strategy_modes=%, invalid_order_modes=%',
      ownerless_strategies,
      ownerless_orders,
      orders_without_strategy,
      mismatched_orders,
      orphaned_orders,
      duplicate_strategies,
      invalid_strategy_modes,
      invalid_order_modes;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "strategy_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strategies" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "strategies_user_id_symbol_idx" ON "strategies" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "strategies_user_id_id_idx" ON "strategies" USING btree ("user_id","id");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_strategy_id_strategies_id_fk'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_strategy_id_strategies_id_fk"
      FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_user_id_strategy_id_strategies_user_id_id_fk'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_user_id_strategy_id_strategies_user_id_id_fk"
      FOREIGN KEY ("user_id", "strategy_id")
      REFERENCES "public"."strategies"("user_id", "id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_mode_dry_run_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_mode_dry_run_check"
      CHECK ("orders"."mode" = 'DRY_RUN');
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'strategies_mode_dry_run_check'
      AND conrelid = 'strategies'::regclass
  ) THEN
    ALTER TABLE "strategies"
      ADD CONSTRAINT "strategies_mode_dry_run_check"
      CHECK ("strategies"."mode" = 'DRY_RUN');
  END IF;
END $$;

--> statement-breakpoint
-- Forward port of recovery 0004_stale_black_knight.sql; does not rewrite its journal.
CREATE TABLE "telegram_login_presentations" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"telegram_user_id" text NOT NULL,
	"auth_date" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX "telegram_login_presentations_expires_at_idx" ON "telegram_login_presentations" USING btree ("expires_at");
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0005_cooing_vapor.sql; does not rewrite its journal.
ALTER TABLE "api_sessions" ADD COLUMN "kind" text DEFAULT 'WEB' NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0006_whole_living_tribunal.sql; does not rewrite its journal.
ALTER TABLE "users" ALTER COLUMN "telegram_chat_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_enabled_at" timestamp;
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0007_burly_amazoness.sql; does not rewrite its journal.
DO $$
DECLARE
  duplicate_pending bigint;
BEGIN
  SELECT coalesce(sum(c - 1), 0) INTO duplicate_pending
  FROM (
    SELECT count(*) AS c
    FROM orders
    WHERE status = 'PENDING'
    GROUP BY user_id, strategy_id
    HAVING count(*) > 1
  ) AS duplicates;

  IF duplicate_pending > 0 THEN
    RAISE EXCEPTION
      'PENDING_ORDER_CONTRACT_PREFLIGHT_FAILED: duplicate_pending=%',
      duplicate_pending;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_pending_per_strategy_idx" ON "orders" USING btree ("user_id","strategy_id") WHERE "orders"."status" = 'PENDING';

--> statement-breakpoint
-- Forward port of recovery 0008_gigantic_taskmaster.sql; does not rewrite its journal.
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"chat_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error_code" text,
	"telegram_message_id" bigint,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_kind_check" CHECK ("notification_outbox"."kind" IN ('PLAIN', 'ORDER_PENDING')),
	CONSTRAINT "notification_outbox_status_check" CHECK ("notification_outbox"."status" IN ('PENDING', 'SENDING', 'DELIVERED', 'RETRY', 'FAILED', 'SKIPPED'))
);
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_id_id_idx" ON "orders" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_order_id_orders_user_id_id_fk" FOREIGN KEY ("user_id","order_id") REFERENCES "public"."orders"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_user_created_at_idx" ON "notification_outbox" USING btree ("user_id","created_at");

--> statement-breakpoint
-- Forward port of recovery 0009_strange_stryfe.sql; does not rewrite its journal.
ALTER TABLE "audit_events" ADD COLUMN "schema_version" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_kind" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_channel" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "payload_class" text;--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_user_id_users_id_fk";
--> statement-breakpoint
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

--> statement-breakpoint
-- Forward port of recovery 0010_wandering_hulk.sql; does not rewrite its journal.
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_v1_envelope_check";--> statement-breakpoint
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
        AND "audit_events"."action" IN (
          'AUTH_LOGIN_SUCCEEDED',
          'AUTH_LOGIN_REJECTED',
          'SESSION_REVOKED',
          'NOTIFICATION_BINDING_VERIFIED',
          'STRATEGY_CREATED',
          'STRATEGY_UPDATED',
          'STRATEGIES_BULK_PAUSED',
          'STRATEGIES_BULK_RESUMED',
          'RISK_DECISION_REJECTED',
          'RISK_DECISION_APPROVED',
          'PENDING_ORDER_DUPLICATE_SUPPRESSED',
          'DRY_RUN_ORDER_COMPLETED',
          'DRY_RUN_ORDER_CANCELLED'
        )
        AND "audit_events"."correlation_id" IS NOT NULL
        AND "audit_events"."correlation_id" ~ '^[A-Za-z0-9_-]{8,80}$'
        AND "audit_events"."payload_class" IS NOT NULL
        AND "audit_events"."payload_class" IN ('SECURITY', 'TENANT_CONFIGURATION', 'TENANT_FINANCIAL', 'OPERATIONAL')
        AND jsonb_typeof("audit_events"."payload") = 'object'
        AND octet_length("audit_events"."payload"::text) <= 8192
      ));
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0011_silky_omega_sentinel.sql; does not rewrite its journal.
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
--> statement-breakpoint
CREATE INDEX "telegram_login_abuse_limits_updated_at_idx" ON "telegram_login_abuse_limits" USING btree ("updated_at");
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0012_black_valkyrie.sql; does not rewrite its journal.
ALTER TABLE "api_sessions" ADD COLUMN "correlation_id" text;--> statement-breakpoint
CREATE INDEX "api_sessions_correlation_id_idx" ON "api_sessions" USING btree ("correlation_id");--> statement-breakpoint
ALTER TABLE "api_sessions" ADD CONSTRAINT "api_sessions_correlation_id_check" CHECK ("api_sessions"."correlation_id" IS NULL OR "api_sessions"."correlation_id" ~ '^[A-Za-z0-9_-]{8,80}$');
--> statement-breakpoint
--> statement-breakpoint
-- Forward port of recovery 0013_immutable_audit_history.sql; does not rewrite its journal.
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_EVENT_IMMUTABLE';
END;
$$;

--> statement-breakpoint
-- Forward port of recovery 0014_bouncy_zuras.sql; does not rewrite its journal.
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

--> statement-breakpoint
