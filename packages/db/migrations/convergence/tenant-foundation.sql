-- Converged tenant foundation. Original audit rows are never rewritten.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dipbot_app') THEN
		CREATE ROLE dipbot_app
			NOLOGIN
			NOSUPERUSER
			NOCREATEDB
			NOCREATEROLE
			NOREPLICATION
			NOBYPASSRLS;
	ELSE
		ALTER ROLE dipbot_app
			NOLOGIN
			NOSUPERUSER
			NOCREATEDB
			NOCREATEROLE
			NOREPLICATION
			NOBYPASSRLS;
	END IF;
END
$$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN
 EXECUTE format('GRANT dipbot_app TO %I WITH INHERIT FALSE, SET TRUE', current_user);
END $$;
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"profile" jsonb NOT NULL,
	"verified_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_subject_unique" UNIQUE("provider", "subject"),
	CONSTRAINT "auth_identities_user_provider_unique" UNIQUE("user_id", "provider"),
	CONSTRAINT "auth_identities_provider_not_blank" CHECK (length(trim("provider")) > 0),
	CONSTRAINT "auth_identities_subject_not_blank" CHECK (length(trim("subject")) > 0)
);
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'personal' NOT NULL,
	"personal_owner_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_personal_owner_unique" UNIQUE("personal_owner_user_id"),
	CONSTRAINT "tenants_kind_owner_check" CHECK (
		("kind" = 'personal' AND "personal_owner_user_id" IS NOT NULL)
		OR ("kind" = 'quarantine' AND "personal_owner_user_id" IS NULL)
	)
);
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_memberships" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_pk" PRIMARY KEY("tenant_id", "user_id"),
	CONSTRAINT "tenant_memberships_owner_only" CHECK ("role" = 'owner')
);
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_destinations" (
	"user_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"chat_type" text DEFAULT 'private' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_destinations_pk" PRIMARY KEY("user_id", "chat_id"),
	CONSTRAINT "telegram_destinations_chat_type_check" CHECK (
		"chat_type" IN ('private', 'legacy_unknown')
	),
	CONSTRAINT "telegram_destinations_unknown_disabled_check" CHECK (
		"chat_type" <> 'legacy_unknown' OR "enabled" = false
	)
);
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "event_ledger_tenant_event_key_unique" UNIQUE("tenant_id", "event_key"),
	CONSTRAINT "event_ledger_status_check" CHECK (
		"status" IN ('PROCESSING', 'COMPLETED', 'FAILED')
	)
);
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_tenant_dedupe_key_unique" UNIQUE("tenant_id", "dedupe_key"),
	CONSTRAINT "outbox_events_status_check" CHECK (
		"status" IN ('PENDING', 'PUBLISHED', 'FAILED')
	),
	CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS tenant_id uuid;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id uuid;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS evaluation_key text;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tg_chat_id text;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS event_key text;
--> statement-breakpoint
-- Historical and SYSTEM audit records may have no tenant. Do not update immutable rows.
ALTER TABLE audit_events ALTER COLUMN tenant_id DROP NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
INSERT INTO tenants (id,kind,personal_owner_user_id)
VALUES ('00000000-0000-4000-8000-000000000022','quarantine',NULL) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO tenants(kind,personal_owner_user_id,created_at)
SELECT 'personal',id,created_at FROM users ON CONFLICT (personal_owner_user_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO tenant_memberships(tenant_id,user_id,role,created_at)
SELECT id,personal_owner_user_id,'owner',created_at FROM tenants WHERE kind='personal'
ON CONFLICT (tenant_id,user_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO auth_identities(user_id,provider,subject,profile,verified_at,created_at,updated_at)
SELECT id,'telegram',telegram_user_id,
 jsonb_strip_nulls(jsonb_build_object('username',username,'firstName',first_name)),created_at,created_at,created_at
FROM users ON CONFLICT (provider,subject) DO NOTHING;
--> statement-breakpoint
UPDATE strategies s SET tenant_id=t.id FROM tenants t WHERE t.personal_owner_user_id=s.user_id AND s.tenant_id IS NULL;
--> statement-breakpoint
UPDATE orders o SET tenant_id=t.id FROM tenants t WHERE t.personal_owner_user_id=o.user_id AND o.tenant_id IS NULL;
--> statement-breakpoint
ALTER TABLE strategies ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='auth_identities'::regclass AND conname='auth_identities_user_id_users_id_fk') THEN
ALTER TABLE "auth_identities"
	ADD CONSTRAINT "auth_identities_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "users"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='tenants'::regclass AND conname='tenants_personal_owner_user_id_users_id_fk') THEN
ALTER TABLE "tenants"
	ADD CONSTRAINT "tenants_personal_owner_user_id_users_id_fk"
	FOREIGN KEY ("personal_owner_user_id") REFERENCES "users"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='tenant_memberships'::regclass AND conname='tenant_memberships_tenant_id_tenants_id_fk') THEN
ALTER TABLE "tenant_memberships"
	ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='tenant_memberships'::regclass AND conname='tenant_memberships_user_id_users_id_fk') THEN
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "users"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='telegram_destinations'::regclass AND conname='telegram_destinations_user_id_users_id_fk') THEN
ALTER TABLE "telegram_destinations"
	ADD CONSTRAINT "telegram_destinations_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "users"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='strategies'::regclass AND conname='strategies_tenant_id_tenants_id_fk') THEN
ALTER TABLE "strategies"
	ADD CONSTRAINT "strategies_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='strategies'::regclass AND conname='strategies_tenant_id_id_unique') THEN
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_tenant_id_id_unique"
	UNIQUE ("tenant_id", "id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='strategies'::regclass AND conname='strategies_tenant_symbol_unique') THEN
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_tenant_symbol_unique"
	UNIQUE ("tenant_id", "symbol");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='strategies'::regclass AND conname='strategies_mode_dry_run') THEN
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_mode_dry_run"
	CHECK ("mode" = 'DRY_RUN');
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_tenant_id_tenants_id_fk') THEN
ALTER TABLE "orders"
	ADD CONSTRAINT "orders_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_tenant_strategy_fk') THEN
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_strategy_fk"
	FOREIGN KEY ("tenant_id", "strategy_id")
	REFERENCES "strategies"("tenant_id", "id")
	DEFERRABLE INITIALLY IMMEDIATE;
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_mode_dry_run') THEN
ALTER TABLE "orders" ADD CONSTRAINT "orders_mode_dry_run"
	CHECK ("mode" = 'DRY_RUN');
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='audit_events'::regclass AND conname='audit_events_tenant_id_tenants_id_fk') THEN
ALTER TABLE "audit_events"
	ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='event_ledger'::regclass AND conname='event_ledger_tenant_id_tenants_id_fk') THEN
ALTER TABLE "event_ledger"
	ADD CONSTRAINT "event_ledger_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='outbox_events'::regclass AND conname='outbox_events_tenant_id_tenants_id_fk') THEN
ALTER TABLE "outbox_events"
	ADD CONSTRAINT "outbox_events_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
END IF; END $$;
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_idx"
	ON "tenant_memberships" ("user_id", "tenant_id");
--> statement-breakpoint
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_destinations_enabled_private_chat_unique"
	ON "telegram_destinations" ("chat_id")
	WHERE "chat_type" = 'private' AND "enabled" = true;
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_destinations_user_enabled_idx"
	ON "telegram_destinations" ("user_id", "enabled");
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategies_tenant_enabled_idx"
	ON "strategies" ("tenant_id", "enabled");
--> statement-breakpoint
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_evaluation_key_unique"
	ON "orders" ("tenant_id", "evaluation_key")
	WHERE "evaluation_key" IS NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_strategy_pending_unique"
	ON "orders" ("tenant_id", "strategy_id")
	WHERE "status" = 'PENDING' AND "strategy_id" IS NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_tenant_created_idx"
	ON "orders" ("tenant_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_tenant_strategy_created_idx"
	ON "orders" ("tenant_id", "strategy_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_tenant_status_execute_idx"
	ON "orders" ("tenant_id", "status", "execute_at");
--> statement-breakpoint
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "audit_events_tenant_event_key_unique"
	ON "audit_events" ("tenant_id", "event_key")
	WHERE "event_key" IS NOT NULL;
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_tenant_created_idx"
	ON "audit_events" ("tenant_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_tenant_entity_idx"
	ON "audit_events" ("tenant_id", "entity_type", "entity_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_ledger_tenant_status_created_idx"
	ON "event_ledger" ("tenant_id", "status", "created_at");
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_pending_available_idx"
	ON "outbox_events" ("available_at")
	WHERE "status" = 'PENDING';
--> statement-breakpoint
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_tenant_created_idx"
	ON "outbox_events" ("tenant_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE tenants ADD CONSTRAINT tenants_owner_id_unique UNIQUE (personal_owner_user_id,id);
--> statement-breakpoint
ALTER TABLE strategies ADD CONSTRAINT strategies_owner_tenant_fk FOREIGN KEY(user_id,tenant_id) REFERENCES tenants(personal_owner_user_id,id);
--> statement-breakpoint
ALTER TABLE orders ADD CONSTRAINT orders_owner_tenant_fk FOREIGN KEY(user_id,tenant_id) REFERENCES tenants(personal_owner_user_id,id);
--> statement-breakpoint
--> statement-breakpoint
REVOKE ALL ON TABLE
	"users",
	"auth_identities",
	"tenants",
	"tenant_memberships",
	"telegram_destinations",
	"strategies",
	"orders",
	"audit_events",
	"event_ledger",
	"outbox_events"
FROM PUBLIC;
--> statement-breakpoint
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO dipbot_app;
--> statement-breakpoint
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
	"tenants",
	"tenant_memberships",
	"telegram_destinations",
	"strategies",
	"orders",
	"event_ledger",
	"outbox_events"
TO dipbot_app;
--> statement-breakpoint
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "audit_events" TO dipbot_app;
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "tenants_owner_access" ON "tenants";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "tenants_owner_access"
	ON "tenants"
	FOR ALL
	TO dipbot_app
	USING (
		"kind" = 'personal'
		AND "personal_owner_user_id" =
			NULLIF(current_setting('app.user_id', true), '')::uuid
	)
	WITH CHECK (
		"kind" = 'personal'
		AND "personal_owner_user_id" =
			NULLIF(current_setting('app.user_id', true), '')::uuid
	);
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_memberships_owner_access" ON "tenant_memberships";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "tenant_memberships_owner_access"
	ON "tenant_memberships"
	FOR ALL
	TO dipbot_app
	USING (
		"user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
		AND "tenant_id" =
			NULLIF(current_setting('app.tenant_id', true), '')::uuid
	)
	WITH CHECK (
		"user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
		AND "tenant_id" =
			NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND "role" = 'owner'
		AND EXISTS (
			SELECT 1
			FROM "tenants"
			WHERE
				"tenants"."id" = "tenant_memberships"."tenant_id"
				AND "tenants"."kind" = 'personal'
				AND "tenants"."personal_owner_user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
		)
	);
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "telegram_destinations_owner_access" ON "telegram_destinations";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "telegram_destinations_owner_access"
	ON "telegram_destinations"
	FOR ALL
	TO dipbot_app
	USING (
		"user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
	)
	WITH CHECK (
		"user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
	);
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "strategies_tenant_access" ON "strategies";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "strategies_tenant_access"
	ON "strategies"
	FOR ALL
	TO dipbot_app
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "strategies"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "strategies"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	);
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "orders_tenant_access" ON "orders";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "orders_tenant_access"
	ON "orders"
	FOR ALL
	TO dipbot_app
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "orders"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "orders"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	);
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "event_ledger_tenant_access" ON "event_ledger";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "event_ledger_tenant_access"
	ON "event_ledger"
	FOR ALL
	TO dipbot_app
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "event_ledger"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "event_ledger"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	);
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS "outbox_events_tenant_access" ON "outbox_events";
--> statement-breakpoint
--> statement-breakpoint
CREATE POLICY "outbox_events_tenant_access"
	ON "outbox_events"
	FOR ALL
	TO dipbot_app
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "outbox_events"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM "tenant_memberships"
			WHERE
				"tenant_memberships"."tenant_id" = "outbox_events"."tenant_id"
				AND "tenant_memberships"."user_id" =
					NULLIF(current_setting('app.user_id', true), '')::uuid
				AND "tenant_memberships"."role" = 'owner'
		)
	);
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "telegram_destinations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "strategies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "telegram_destinations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "strategies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_ledger" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
--> statement-breakpoint
DROP POLICY IF EXISTS audit_events_tenant_access ON audit_events;
--> statement-breakpoint
CREATE POLICY audit_events_tenant_access ON audit_events FOR ALL TO dipbot_app
USING (user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND EXISTS (SELECT 1 FROM tenant_memberships WHERE tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid AND user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND role='owner'))
WITH CHECK (user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND EXISTS (SELECT 1 FROM tenant_memberships WHERE tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid AND user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND role='owner')
 AND tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON notification_outbox TO dipbot_app;
--> statement-breakpoint
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notification_outbox FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notification_outbox_owner_access ON notification_outbox FOR ALL TO dipbot_app
USING (user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND EXISTS (SELECT 1 FROM tenant_memberships WHERE tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid AND user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND role='owner'))
WITH CHECK (user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND EXISTS (SELECT 1 FROM tenant_memberships WHERE tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid AND user_id = NULLIF(current_setting('app.user_id',true),'')::uuid AND role='owner'));
--> statement-breakpoint
--> statement-breakpoint
-- Compatibility writes still name an owner. Resolve exactly that owner's tenant.
CREATE FUNCTION dipbot_set_owned_tenant() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE owned_tenant uuid;
BEGIN
 IF NEW.user_id IS NULL THEN
  IF TG_TABLE_NAME='audit_events' THEN
   IF NEW.schema_version=0 OR (NEW.scope='SYSTEM' AND NEW.tenant_id IS NULL) THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'TENANT_OWNER_REQUIRED';
 END IF;
 SELECT id INTO owned_tenant FROM public.tenants WHERE kind='personal' AND personal_owner_user_id=NEW.user_id;
 IF owned_tenant IS NULL OR (NEW.tenant_id IS NOT NULL AND NEW.tenant_id<>owned_tenant)
 THEN RAISE EXCEPTION 'TENANT_OWNER_MISMATCH'; END IF;
 NEW.tenant_id:=owned_tenant;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER strategies_owned_tenant BEFORE INSERT OR UPDATE ON strategies FOR EACH ROW EXECUTE FUNCTION dipbot_set_owned_tenant();
--> statement-breakpoint
CREATE TRIGGER orders_owned_tenant BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION dipbot_set_owned_tenant();
--> statement-breakpoint
CREATE TRIGGER audit_owned_tenant BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION dipbot_set_owned_tenant();
--> statement-breakpoint
--> statement-breakpoint
-- Only trusted auth/bootstrap connections insert users. No SECURITY DEFINER escalation.
CREATE FUNCTION dipbot_provision_personal_tenant() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE owned_tenant uuid;
BEGIN
 INSERT INTO public.tenants(kind,personal_owner_user_id,created_at) VALUES('personal',NEW.id,NEW.created_at)
 ON CONFLICT(personal_owner_user_id) DO UPDATE SET personal_owner_user_id=EXCLUDED.personal_owner_user_id RETURNING id INTO owned_tenant;
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES(owned_tenant,NEW.id,'owner') ON CONFLICT DO NOTHING;
 INSERT INTO public.auth_identities(user_id,provider,subject,profile,verified_at)
 VALUES(NEW.id,'telegram',NEW.telegram_user_id,jsonb_strip_nulls(jsonb_build_object('username',NEW.username,'firstName',NEW.first_name)),NEW.created_at)
 ON CONFLICT(provider,subject) DO UPDATE SET profile=EXCLUDED.profile,updated_at=now();
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_personal_tenant AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION dipbot_provision_personal_tenant();
