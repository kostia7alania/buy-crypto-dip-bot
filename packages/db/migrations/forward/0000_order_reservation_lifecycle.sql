DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM orders o
		LEFT JOIN strategies s
			ON s.id = o.strategy_id AND s.user_id = o.user_id
		WHERE o.status = 'PENDING'
			AND (
				o.quote_amount <= 0
				OR s.id IS NULL
				OR jsonb_typeof(s.config) IS DISTINCT FROM 'object'
			)
	) THEN
		RAISE EXCEPTION 'MIGRATION_PENDING_ORDER_RESERVATION_INVALID';
	END IF;
END
$$;
--> statement-breakpoint
CREATE TABLE "order_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT NULL NOT NULL,
	"user_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quote_amount" numeric NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"policy_version" text NOT NULL,
	"config_revision" text NOT NULL,
	"strategy_config" jsonb NOT NULL,
	"market_snapshot_key" text NOT NULL,
	"market_snapshot" jsonb NOT NULL,
	"risk_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "order_reservations_order_unique" UNIQUE("order_id"),
	CONSTRAINT "order_reservations_quote_positive_check" CHECK ("quote_amount" > 0),
	CONSTRAINT "order_reservations_status_check" CHECK ("status" IN ('ACTIVE', 'CONSUMED', 'RELEASED')),
	CONSTRAINT "order_reservations_resolution_check" CHECK (
		("status" = 'ACTIVE' AND "resolved_at" IS NULL)
		OR ("status" <> 'ACTIVE' AND "resolved_at" IS NOT NULL)
	),
	CONSTRAINT "order_reservations_snapshot_shape_check" CHECK (
		jsonb_typeof("strategy_config") = 'object'
		AND jsonb_typeof("market_snapshot") = 'object'
		AND jsonb_typeof("risk_snapshot") = 'object'
	)
);
--> statement-breakpoint
ALTER TABLE "order_reservations"
	ADD CONSTRAINT "order_reservations_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
--> statement-breakpoint
ALTER TABLE "order_reservations"
	ADD CONSTRAINT "order_reservations_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "order_reservations"
	ADD CONSTRAINT "order_reservations_user_strategy_fk"
	FOREIGN KEY ("user_id", "strategy_id")
	REFERENCES "strategies"("user_id", "id");
--> statement-breakpoint
ALTER TABLE "order_reservations"
	ADD CONSTRAINT "order_reservations_user_order_fk"
	FOREIGN KEY ("user_id", "order_id")
	REFERENCES "orders"("user_id", "id");
--> statement-breakpoint
ALTER TABLE "order_reservations"
	ADD CONSTRAINT "order_reservations_owner_tenant_fk"
	FOREIGN KEY ("user_id", "tenant_id")
	REFERENCES "tenants"("personal_owner_user_id", "id");
--> statement-breakpoint
CREATE INDEX "order_reservations_strategy_status_idx"
	ON "order_reservations" ("user_id", "strategy_id", "status");
--> statement-breakpoint
CREATE INDEX "order_reservations_tenant_snapshot_idx"
	ON "order_reservations" ("tenant_id", "market_snapshot_key");
--> statement-breakpoint
CREATE TRIGGER order_reservations_owned_tenant
	BEFORE INSERT OR UPDATE ON order_reservations
	FOR EACH ROW EXECUTE FUNCTION dipbot_set_owned_tenant();
--> statement-breakpoint
INSERT INTO order_reservations (
	tenant_id,
	user_id,
	strategy_id,
	order_id,
	quote_amount,
	status,
	policy_version,
	config_revision,
	strategy_config,
	market_snapshot_key,
	market_snapshot,
	risk_snapshot,
	created_at
)
SELECT
	o.tenant_id,
	o.user_id,
	o.strategy_id,
	o.id,
	o.quote_amount,
	'ACTIVE',
	'LEGACY_BACKFILL',
	'legacy-order:' || o.id::text,
	s.config,
	'legacy-order:' || o.id::text,
	jsonb_build_object(
		'source', 'LEGACY_PENDING_BACKFILL',
		'symbol', o.symbol,
		'price', o.price,
		'observedAt', NULL
	),
	jsonb_build_object(
		'provenance', 'LEGACY_PENDING_BACKFILL',
		'limitsEvaluated', false
	),
	o.created_at
FROM orders o
JOIN strategies s
	ON s.id = o.strategy_id AND s.user_id = o.user_id
WHERE o.status = 'PENDING'
ON CONFLICT (order_id) DO NOTHING;
--> statement-breakpoint
REVOKE ALL ON TABLE "order_reservations" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "order_reservations" TO dipbot_app;
--> statement-breakpoint
GRANT UPDATE ("status", "resolved_at") ON TABLE "order_reservations" TO dipbot_app;
--> statement-breakpoint
ALTER TABLE "order_reservations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_reservations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "order_reservations_tenant_access"
	ON "order_reservations"
	FOR ALL
	TO dipbot_app
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND "user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM tenant_memberships
			WHERE tenant_memberships.tenant_id = order_reservations.tenant_id
				AND tenant_memberships.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
				AND tenant_memberships.role = 'owner'
		)
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		AND "user_id" = NULLIF(current_setting('app.user_id', true), '')::uuid
		AND EXISTS (
			SELECT 1
			FROM tenant_memberships
			WHERE tenant_memberships.tenant_id = order_reservations.tenant_id
				AND tenant_memberships.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
				AND tenant_memberships.role = 'owner'
		)
	);
--> statement-breakpoint
CREATE FUNCTION dipbot_guard_order_reservation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'ORDER_RESERVATION_IMMUTABLE';
	END IF;

	IF ROW(
		OLD.id,
		OLD.tenant_id,
		OLD.user_id,
		OLD.strategy_id,
		OLD.order_id,
		OLD.quote_amount,
		OLD.policy_version,
		OLD.config_revision,
		OLD.strategy_config,
		OLD.market_snapshot_key,
		OLD.market_snapshot,
		OLD.risk_snapshot,
		OLD.created_at
	) IS DISTINCT FROM ROW(
		NEW.id,
		NEW.tenant_id,
		NEW.user_id,
		NEW.strategy_id,
		NEW.order_id,
		NEW.quote_amount,
		NEW.policy_version,
		NEW.config_revision,
		NEW.strategy_config,
		NEW.market_snapshot_key,
		NEW.market_snapshot,
		NEW.risk_snapshot,
		NEW.created_at
	) THEN
		RAISE EXCEPTION 'ORDER_RESERVATION_EVIDENCE_IMMUTABLE';
	END IF;

	IF OLD.status <> 'ACTIVE'
		OR NEW.status NOT IN ('CONSUMED', 'RELEASED')
		OR NEW.resolved_at IS NULL
	THEN
		RAISE EXCEPTION 'ORDER_RESERVATION_TRANSITION_INVALID';
	END IF;

	RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION dipbot_guard_order_reservation_mutation() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION dipbot_guard_order_reservation_mutation() TO dipbot_app;
--> statement-breakpoint
CREATE TRIGGER order_reservations_immutable
	BEFORE UPDATE OR DELETE ON order_reservations
	FOR EACH ROW EXECUTE FUNCTION dipbot_guard_order_reservation_mutation();
--> statement-breakpoint
CREATE FUNCTION dipbot_resolve_order_reservation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	next_reservation_status text;
	changed_rows integer;
BEGIN
	IF OLD.status <> 'PENDING' THEN
		RETURN NEW;
	END IF;

	IF NEW.status = 'COMPLETED' THEN
		next_reservation_status := 'CONSUMED';
	ELSIF NEW.status = 'CANCELLED' THEN
		next_reservation_status := 'RELEASED';
	ELSE
		RAISE EXCEPTION 'ORDER_RESERVATION_ORDER_TRANSITION_INVALID';
	END IF;

	UPDATE order_reservations
	SET status = next_reservation_status,
		resolved_at = now()
	WHERE order_id = NEW.id
		AND user_id = NEW.user_id
		AND status = 'ACTIVE';
	GET DIAGNOSTICS changed_rows = ROW_COUNT;

	IF changed_rows <> 1 THEN
		RAISE EXCEPTION 'ORDER_RESERVATION_MISSING_OR_SETTLED';
	END IF;

	RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION dipbot_resolve_order_reservation() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION dipbot_resolve_order_reservation() TO dipbot_app;
--> statement-breakpoint
CREATE TRIGGER orders_resolve_reservation
	AFTER UPDATE OF status ON orders
	FOR EACH ROW
	WHEN (OLD.status IS DISTINCT FROM NEW.status)
	EXECUTE FUNCTION dipbot_resolve_order_reservation();
--> statement-breakpoint
CREATE FUNCTION dipbot_assert_order_reservation_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	subject_order_id uuid;
	order_status text;
	reservation_status text;
BEGIN
	IF TG_TABLE_NAME = 'orders' THEN
		subject_order_id := NEW.id;
	ELSIF TG_OP = 'DELETE' THEN
		subject_order_id := OLD.order_id;
	ELSE
		subject_order_id := NEW.order_id;
	END IF;

	SELECT o.status, r.status
	INTO order_status, reservation_status
	FROM orders o
	LEFT JOIN order_reservations r ON r.order_id = o.id
	WHERE o.id = subject_order_id;

	IF order_status = 'PENDING'
		AND reservation_status IS DISTINCT FROM 'ACTIVE'
	THEN
		RAISE EXCEPTION 'PENDING_ORDER_ACTIVE_RESERVATION_REQUIRED';
	END IF;

	IF reservation_status = 'ACTIVE' AND order_status IS DISTINCT FROM 'PENDING' THEN
		RAISE EXCEPTION 'ACTIVE_RESERVATION_PENDING_ORDER_REQUIRED';
	ELSIF reservation_status = 'CONSUMED' AND order_status IS DISTINCT FROM 'COMPLETED' THEN
		RAISE EXCEPTION 'CONSUMED_RESERVATION_COMPLETED_ORDER_REQUIRED';
	ELSIF reservation_status = 'RELEASED' AND order_status IS DISTINCT FROM 'CANCELLED' THEN
		RAISE EXCEPTION 'RELEASED_RESERVATION_CANCELLED_ORDER_REQUIRED';
	END IF;

	RETURN NULL;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION dipbot_assert_order_reservation_consistency() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION dipbot_assert_order_reservation_consistency() TO dipbot_app;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER orders_reservation_consistency
	AFTER INSERT OR UPDATE OF status ON orders
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION dipbot_assert_order_reservation_consistency();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER order_reservations_order_consistency
	AFTER INSERT OR UPDATE OF status OR DELETE ON order_reservations
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION dipbot_assert_order_reservation_consistency();
