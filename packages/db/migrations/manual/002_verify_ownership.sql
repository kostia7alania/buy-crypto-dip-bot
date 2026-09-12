-- ExecPlan 005 / ticket I05 — verification report.
--
-- Read-only. Every value in must_be_zero has to be 0 before
-- 003_contract_ownership.sql may run.

SELECT
  'strategies without an owner' AS category,
  count(*) AS must_be_zero,
  'Assign explicitly to the operator account, or delete if they are seed rows with no real history.' AS resolution
FROM strategies
WHERE user_id IS NULL

UNION ALL

SELECT
  'orders without an owner',
  count(*),
  'Usually caused by an ownerless strategy. Fix the strategy first, then re-run 001.'
FROM orders
WHERE user_id IS NULL

UNION ALL

SELECT
  'orders without a strategy',
  count(*),
  'Restore the accountable strategy or quarantine the order before the contract migration.'
FROM orders
WHERE strategy_id IS NULL

UNION ALL

SELECT
  'orders whose owner disagrees with their strategy',
  count(*),
  'Data corruption — investigate before contracting. The composite FK will reject this state afterward.'
FROM orders o
JOIN strategies s ON o.strategy_id = s.id
WHERE o.user_id IS DISTINCT FROM s.user_id

UNION ALL

SELECT
  'orders pointing at a strategy that does not exist',
  count(*),
  'Delete the orphans or restore the strategy; the FK added in step 3 would reject these.'
FROM orders o
WHERE o.strategy_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM strategies s WHERE s.id = o.strategy_id)

UNION ALL

SELECT
  'duplicate (user_id, symbol) strategy pairs',
  coalesce(sum(c - 1), 0),
  'The unique index in step 3 would reject these. Merge or delete the duplicates first.'
FROM (
  SELECT count(*) AS c
  FROM strategies
  WHERE user_id IS NOT NULL
  GROUP BY user_id, symbol
  HAVING count(*) > 1
) AS dupes;

-- DRY_RUN is the only executable mode before a later, separately approved
-- gate. Persisted values outside that boundary are contract blockers.
SELECT
  'strategies outside DRY_RUN mode' AS category,
  count(*) AS must_be_zero,
  'Disable and investigate the row; do not coerce live state during migration.' AS resolution
FROM strategies
WHERE mode <> 'DRY_RUN'

UNION ALL

SELECT
  'orders outside DRY_RUN mode',
  count(*),
  'Quarantine and investigate the evidence before applying the contract.'
FROM orders
WHERE mode <> 'DRY_RUN';

-- Informational only — these are expected to be non-zero and are not a blocker.
SELECT
  'audit events with no tenant (operator-level)' AS category,
  count(*) AS informational
FROM audit_events
WHERE user_id IS NULL;
