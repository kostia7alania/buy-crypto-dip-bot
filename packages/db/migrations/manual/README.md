# Manual migrations

The backfill and verification scripts are **not** applied by
`runMigrations()`. The final contract is the journalled automatic migration
`0003_unusual_blue_shield.sql`; the manual `003` file is only a compatibility
entrypoint that includes that authoritative migration.

`runMigrations()` runs automatically when the runner boots, which is right for
purely structural changes and wrong for anything that decides who owns money.
The scripts in this folder rewrite ownership of real trading history, so they
are run deliberately, by a person, against a database they have just backed up.

## Ownership backfill sequence (ExecPlan 005, tickets I05–I06)

Run in order. Do not skip step 2.

| Step | File | Reversible |
| --- | --- | --- |
| 0 | `packages/db/migrations/0002_left_pride.sql` (automatic) | yes |
| 1 | `001_backfill_ownership.sql` | yes |
| 2 | `002_verify_ownership.sql` | read-only |
| 3 | validated record in `decision-records/` | read-only gate |
| 4 | `0003_unusual_blue_shield.sql` via deploy/migrator or the `003` wrapper | **no** |
| 5 | `004_inventory_quarantined_audit.sql` after automatic `0009`–`0013` | read-only |

### Step 1 — backfill

```bash
psql "$POSTGRES_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f 001_backfill_ownership.sql
```

Derives each row's owner from a relationship that already exists. It never
guesses: a row whose owner cannot be derived is left `NULL` for step 2 to
report. The script is idempotent — running it twice changes nothing the second
time.

### Step 2 — verify

```bash
psql "$POSTGRES_CONNECTION_STRING" -f 002_verify_ownership.sql
```

Prints one row per category of unresolved data. **Every count in the
`must_be_zero` column must be 0 before step 4.** If it is not, the remaining
rows belong to nobody the database can identify, and someone has to decide
their fate explicitly:

- assign them to the operator account, if this is a self-hosted single-user
  install that predates multi-user;
- or delete confirmed non-audit seed rows with explicit authorization. Audit
  history is never deleted: unresolved audit rows remain recoverable as V0.

There is deliberately no `--force` here. A trading history with an ambiguous
owner is a question for a human.

### Step 3 — durable decision record

Copy `decision-records/TEMPLATE.json`, fill it from the saved step-2 output,
and store it with the deployment evidence. The record captures approver,
category counts, dispositions, unresolved items, verified backup reference,
source/target catalogs, and the verification-output digest without row
payloads or secrets. Every non-zero category requires an explicit disposition
and authorization reference.

```bash
pnpm --filter @buy-crypto-dip-bot/db db:verify-legacy-decision -- \
  migrations/manual/decision-records/<decision-id>.json
```

Do not continue unless this prints `LEGACY_DECISION_VALID`. The template itself
is not an approval and must never be represented as one.

### Step 4 — contract

```bash
psql "$POSTGRES_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f 003_contract_ownership.sql
```

Applies `NOT NULL`, the single-owner and same-owner composite foreign keys,
`UNIQUE (user_id, symbol)`, and the `DRY_RUN` checks. This is the irreversible
step; it is also the one that makes cross-tenant order/strategy relationships
structurally impossible rather than merely absent from the current queries.

If it fails, the application must stay unavailable. The journalled migration
runs transactionally through Drizzle, and its own preflight reports only row
counts/categories, never row payloads or secrets.

### Step 5 — retain and inventory legacy audit evidence

Migrations `0009/0010` mark pre-contract audit rows as `schema_version = 0`.
Migration `0013` makes every audit row immutable: both `UPDATE` and `DELETE`
fail for V0 and V1. The tenant audit endpoint returns only owner-scoped V1
events, so V0 is quarantined from customer surfaces without being destroyed or
falsely reclassified. Run `004_inventory_quarantined_audit.sql` to capture
aggregate V0 evidence in the upgrade bundle; it prints neither payloads nor row
IDs.

V0 evidence cannot be remediated in place after `0013`. Any later attribution
must be represented by a new append-only V1 event that refers to the retained
V0 evidence without copying its payload. Audit mutation and deletion are not
allowed dispositions.

## Note on `audit_events.user_id`

It stays nullable on purpose. Validated V1 rows distinguish `scope = USER`
(owner required) from `scope = SYSTEM` (owner absent) through database checks.
Legacy V0 rows keep their original uncertainty and are excluded from the tenant
feed rather than exposed, deleted, or silently relabeled.
