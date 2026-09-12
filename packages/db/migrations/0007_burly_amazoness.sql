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
