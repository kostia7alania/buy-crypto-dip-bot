-- ExecPlan 005 / ticket I05 — backfill ownership.
--
-- Derives owners from relationships that already exist in the data. Never
-- guesses: anything not derivable is left NULL for 002_verify_ownership.sql to
-- report, because assigning a stranger's trading history to "the first user in
-- the table" is worse than refusing to migrate.
--
-- Idempotent: every statement is guarded by "WHERE user_id IS NULL".
-- This script must run in the documented pre-contract sequence, before
-- migration 0009 installs the audit trigger and 0013 makes V0 immutable too.

BEGIN;

-- 1. Orders inherit their strategy's owner.
UPDATE orders o
SET user_id = s.user_id
FROM strategies s
WHERE o.strategy_id = s.id
  AND o.user_id IS NULL
  AND s.user_id IS NOT NULL;

-- 2. Audit events about a strategy inherit that strategy's owner.
--    entity_id is text, so it is cast rather than compared directly.
UPDATE audit_events a
SET user_id = s.user_id
FROM strategies s
WHERE a.entity_type = 'strategy'
  AND a.entity_id = s.id::text
  AND a.user_id IS NULL
  AND s.user_id IS NOT NULL;

-- 3. Audit events about an order inherit that order's owner (set in step 1).
UPDATE audit_events a
SET user_id = o.user_id
FROM orders o
WHERE a.entity_type = 'order'
  AND a.entity_id = o.id::text
  AND a.user_id IS NULL
  AND o.user_id IS NOT NULL;

-- 4. Audit events about a user are owned by that user.
UPDATE audit_events a
SET user_id = u.id
FROM users u
WHERE a.entity_type = 'user'
  AND a.entity_id = u.id::text
  AND a.user_id IS NULL;

-- Deliberately NOT backfilled:
--
--   * strategies.user_id — a strategy is the root of ownership. If it has no
--     owner there is nothing to derive one from, and inventing one would hand
--     somebody a stranger's running bot. These are reported by step 2 and
--     resolved by a human.
--
--   * audit_events with entity_id = 'ALL' (install-wide pause/resume) — these
--     legitimately belong to no single tenant and stay null.

COMMIT;
