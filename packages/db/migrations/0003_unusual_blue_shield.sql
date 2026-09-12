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
