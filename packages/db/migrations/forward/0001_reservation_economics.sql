-- Keep the preflight and constraints on the same stable set of rows.
LOCK TABLE orders, order_reservations IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM orders
    WHERE NOT (quote_amount > '-Infinity'::numeric AND quote_amount < 'Infinity'::numeric)
  ) OR EXISTS (
    SELECT 1 FROM order_reservations
    WHERE NOT (quote_amount > 0 AND quote_amount < 'Infinity'::numeric)
  ) THEN
    RAISE EXCEPTION 'MIGRATION_RESERVATION_AMOUNT_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM order_reservations r
    LEFT JOIN orders o ON o.id = r.order_id
    WHERE o.id IS NULL OR ROW(r.user_id, r.tenant_id, r.strategy_id, r.quote_amount)
      IS DISTINCT FROM ROW(o.user_id, o.tenant_id, o.strategy_id, o.quote_amount)
  ) THEN
    RAISE EXCEPTION 'MIGRATION_RESERVATION_ECONOMICS_MISMATCH';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE orders ADD CONSTRAINT orders_quote_finite_check
  CHECK (quote_amount > '-Infinity'::numeric AND quote_amount < 'Infinity'::numeric);
--> statement-breakpoint
ALTER TABLE order_reservations DROP CONSTRAINT order_reservations_quote_positive_check;
--> statement-breakpoint
ALTER TABLE order_reservations ADD CONSTRAINT order_reservations_quote_positive_check
  CHECK (quote_amount > 0 AND quote_amount < 'Infinity'::numeric);
--> statement-breakpoint
CREATE UNIQUE INDEX orders_reservation_economics_idx
  ON orders (user_id, tenant_id, id, strategy_id, quote_amount);
--> statement-breakpoint
ALTER TABLE order_reservations ADD CONSTRAINT order_reservations_order_economics_fk
  FOREIGN KEY (user_id, tenant_id, order_id, strategy_id, quote_amount)
  REFERENCES orders (user_id, tenant_id, id, strategy_id, quote_amount);
--> statement-breakpoint
-- Version the parent without changing evidence. A lock alone would let a
-- REPEATABLE READ updater miss a newly attached reservation in its old snapshot.
CREATE FUNCTION dipbot_lock_reservation_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.orders SET id = id
  WHERE id = NEW.order_id AND user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_RESERVATION_ORDER_REQUIRED';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION dipbot_lock_reservation_order() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION dipbot_lock_reservation_order() TO dipbot_app;
--> statement-breakpoint
CREATE TRIGGER order_reservations_lock_order
  BEFORE INSERT ON order_reservations
  FOR EACH ROW EXECUTE FUNCTION dipbot_lock_reservation_order();
--> statement-breakpoint
CREATE FUNCTION dipbot_guard_reserved_order_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF ROW(OLD.id, OLD.user_id, OLD.tenant_id, OLD.strategy_id, OLD.symbol,
    OLD.mode, OLD.side, OLD.quote_amount, OLD.price, OLD.risk_decision_id,
    OLD.evaluation_key, OLD.created_at)
    IS DISTINCT FROM
    ROW(NEW.id, NEW.user_id, NEW.tenant_id, NEW.strategy_id, NEW.symbol,
    NEW.mode, NEW.side, NEW.quote_amount, NEW.price, NEW.risk_decision_id,
    NEW.evaluation_key, NEW.created_at)
    AND EXISTS (SELECT 1 FROM public.order_reservations WHERE order_id = OLD.id)
  THEN
    RAISE EXCEPTION 'RESERVED_ORDER_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION dipbot_guard_reserved_order_evidence() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION dipbot_guard_reserved_order_evidence() TO dipbot_app;
--> statement-breakpoint
CREATE TRIGGER orders_reserved_evidence_immutable
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION dipbot_guard_reserved_order_evidence();
