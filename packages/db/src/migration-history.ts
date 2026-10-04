import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { DatabaseConnection } from "./adapters.js";

type Db = DatabaseConnection["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Migration = ReturnType<typeof readMigrationFiles>[number];
type Applied = { hash: string; created_at: string | number };
export const CONVERGED_CATALOG = "gate1_tenants_v1";

const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");

export const recognizeMigrationHistory = (
  rows: Applied[],
  recovery: Migration[],
  costFirst: Migration[],
): "recovery" | "cost-first" => {
  const matches = (history: Migration[]) =>
    rows.length <= history.length &&
    rows.every(
      (row, index) =>
        row.hash === history[index]?.hash &&
        Number(row.created_at) === history[index]?.folderMillis,
    );
  // Empty and shared 0000/0001 prefixes deliberately follow the recovery path.
  if (matches(recovery)) return "recovery";
  if (matches(costFirst)) return "cost-first";
  throw new Error("MIGRATION_HISTORY_UNKNOWN_OR_MODIFIED");
};

const executeFile = async (tx: Tx, contents: string) => {
  for (const statement of contents.split("--> statement-breakpoint")) {
    if (statement.trim()) await tx.execute(sql.raw(statement));
  }
};

const assertTenantCatalog = async (tx: Tx) => {
  const result = await tx.execute<{ ready: boolean }>(sql`
    select (
      (select count(*)=4 from pg_class where oid in
        (to_regclass('public.strategies'),to_regclass('public.orders'),
         to_regclass('public.audit_events'),to_regclass('public.notification_outbox'))
         and relrowsecurity and relforcerowsecurity)
      and exists(select 1 from pg_roles where rolname='dipbot_app'
        and not rolsuper and not rolbypassrls and not rolcanlogin)
      and (select count(*)=4 from pg_trigger where not tgisinternal and tgenabled='O'
        and (tgrelid,tgname) in (
          ('public.strategies'::regclass,'strategies_owned_tenant'),
          ('public.orders'::regclass,'orders_owned_tenant'),
          ('public.audit_events'::regclass,'audit_owned_tenant'),
          ('public.users'::regclass,'users_personal_tenant')))
    ) as ready
  `);
  if (!result.rows[0]?.ready) throw new Error("MIGRATION_TENANT_CATALOG_DRIFT");
};

const assertReservationCatalog = async (tx: Tx) => {
  const result = await tx.execute<{ ready: boolean }>(sql`
    select (
      exists(select 1 from pg_class where oid=to_regclass('public.order_reservations')
        and relrowsecurity and relforcerowsecurity)
      and (select count(*)=7 from pg_trigger where not tgisinternal and tgenabled='O'
        and (tgrelid,tgname) in (
          ('public.orders'::regclass,'orders_reserved_evidence_immutable'),
          ('public.orders'::regclass,'orders_resolve_reservation'),
          ('public.orders'::regclass,'orders_reservation_consistency'),
          ('public.order_reservations'::regclass,'order_reservations_owned_tenant'),
          ('public.order_reservations'::regclass,'order_reservations_lock_order'),
          ('public.order_reservations'::regclass,'order_reservations_immutable'),
          ('public.order_reservations'::regclass,'order_reservations_order_consistency')))
      and (select count(*)=3 from pg_constraint where convalidated
        and (conrelid,conname) in (
          ('public.orders'::regclass,'orders_quote_finite_check'),
          ('public.order_reservations'::regclass,'order_reservations_quote_positive_check'),
          ('public.order_reservations'::regclass,'order_reservations_order_economics_fk')))
    ) as ready
  `);
  if (!result.rows[0]?.ready)
    throw new Error("MIGRATION_RESERVATION_CATALOG_DRIFT");
};

const applyForwardMigrations = async (tx: Tx, history: Migration[]) => {
  await tx.execute(sql`create table if not exists drizzle.__dipbot_forward_migrations (
    id serial primary key, hash text not null, created_at bigint not null
  )`);
  const rows = (
    await tx.execute<Applied>(sql`
    select hash,created_at from drizzle.__dipbot_forward_migrations order by id
  `)
  ).rows;
  if (
    rows.length > history.length ||
    rows.some(
      (row, index) =>
        row.hash !== history[index]?.hash ||
        Number(row.created_at) !== history[index]?.folderMillis,
    )
  ) {
    throw new Error("MIGRATION_FORWARD_HISTORY_UNKNOWN_OR_MODIFIED");
  }
  for (const migration of history.slice(rows.length)) {
    if (
      !migration.sql.some((statement) =>
        statement.replace(/--[^\n]*/g, "").trim(),
      )
    ) {
      throw new Error("MIGRATION_FORWARD_SQL_EMPTY");
    }
    for (const statement of migration.sql) {
      if (statement.trim()) await tx.execute(sql.raw(statement));
    }
    await tx.execute(sql`insert into drizzle.__dipbot_forward_migrations(hash,created_at)
      values(${migration.hash},${migration.folderMillis})`);
  }
};

const readExpectedHistory = (folder: string) => {
  const recovery = readMigrationFiles({ migrationsFolder: folder });
  const costFirst = readMigrationFiles({
    migrationsFolder: path.join(folder, "histories/cost-first"),
  });
  const bridge = readFileSync(
    path.join(folder, "convergence/cost-first-to-recovery.sql"),
    "utf8",
  );
  const foundation = readFileSync(
    path.join(folder, "convergence/tenant-foundation.sql"),
    "utf8",
  );
  const targetHash = digest(
    JSON.stringify([digest(bridge), digest(foundation)]),
  );
  const forward = readMigrationFiles({
    migrationsFolder: path.join(folder, "forward"),
  });
  return { recovery, costFirst, bridge, foundation, targetHash, forward };
};

export const verifyKnownHistory = async (db: Db, folder: string) => {
  const { recovery, costFirst, targetHash, forward } =
    readExpectedHistory(folder);
  await db.transaction(
    async (tx) => {
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const catalog = await tx.execute<{ ready: boolean }>(sql`
      select to_regclass('drizzle.__drizzle_migrations') is not null
        and to_regclass('drizzle.__dipbot_convergence') is not null
        and to_regclass('drizzle.__dipbot_forward_migrations') is not null as ready
    `);
      if (!catalog.rows[0]?.ready)
        throw new Error("DATABASE_MIGRATION_REQUIRED");
      const rows = (
        await tx.execute<Applied>(sql`
      select hash,created_at from drizzle.__drizzle_migrations order by id
    `)
      ).rows;
      const lineage = recognizeMigrationHistory(rows, recovery, costFirst);
      const history = lineage === "recovery" ? recovery : costFirst;
      const marker = await tx.execute<{
        source_history: string;
        target: string;
        target_hash: string;
      }>(
        sql`select source_history,target,target_hash from drizzle.__dipbot_convergence`,
      );
      if (
        rows.length !== history.length ||
        marker.rows.length !== 1 ||
        marker.rows[0]?.source_history !== lineage ||
        marker.rows[0]?.target !== CONVERGED_CATALOG ||
        marker.rows[0]?.target_hash !== targetHash
      ) {
        throw new Error("MIGRATION_CONVERGENCE_RECORD_MISMATCH");
      }
      const applied = (
        await tx.execute<Applied>(sql`
      select hash,created_at from drizzle.__dipbot_forward_migrations order by id
    `)
      ).rows;
      if (
        applied.length !== forward.length ||
        applied.some(
          (row, index) =>
            row.hash !== forward[index]?.hash ||
            Number(row.created_at) !== forward[index]?.folderMillis,
        )
      ) {
        throw new Error("DATABASE_FORWARD_MIGRATION_REQUIRED_OR_MODIFIED");
      }
      await assertTenantCatalog(tx);
      await assertReservationCatalog(tx);
      await assertRuntimeCredentials(tx);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
};

const assertRuntimeCredentials = async (tx: Tx) => {
  const result = await tx.execute<{ ready: boolean }>(sql`
    select (
      session_user = 'dipbot_runtime' and current_user = session_user
      and exists(select 1 from pg_roles where rolname=current_user
        and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb
        and not rolcreaterole and not rolreplication and not rolinherit)
      and (select count(*)=1 from pg_auth_members m
        where m.member=(select oid from pg_roles where rolname=current_user))
      and exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid
        where m.member=(select oid from pg_roles where rolname=current_user)
          and r.rolname='dipbot_app' and m.set_option
          and not m.inherit_option and not m.admin_option)
      and not exists(select 1 from pg_auth_members
        where member=(select oid from pg_roles where rolname='dipbot_app'))
      and not exists(select 1 from pg_roles where rolname='dipbot_app'
        and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
      and has_database_privilege(current_user,current_database(),'CONNECT')
      and not has_database_privilege(current_user,current_database(),'CREATE')
      and not has_database_privilege(current_user,current_database(),'TEMP')
      and not exists(select 1 from pg_database where datname=current_database()
        and pg_has_role(current_user,datdba,'USAGE'))
      and not has_schema_privilege(current_user,'public','CREATE')
      and not has_schema_privilege(current_user,'drizzle','CREATE')
      and not exists(select 1 from pg_namespace where nspname in ('public','drizzle')
        and pg_has_role(current_user,nspowner,'USAGE'))
      and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','drizzle') and pg_has_role(current_user,c.relowner,'USAGE'))
      and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','drizzle') and pg_has_role(current_user,p.proowner,'USAGE'))
      and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','drizzle') and c.relkind in ('r','p')
          and (has_table_privilege(current_user,c.oid,'TRUNCATE')
            or (n.nspname='drizzle' and
              (has_table_privilege(current_user,c.oid,'INSERT')
               or has_table_privilege(current_user,c.oid,'UPDATE')
               or has_table_privilege(current_user,c.oid,'DELETE')))))
    ) as ready
  `);
  if (!result.rows[0]?.ready)
    throw new Error("DATABASE_RUNTIME_CREDENTIALS_INVALID");
};

/** Hash-checked, append-only convergence under one transaction/advisory lock. */
export const migrateKnownHistory = async (db: Db, folder: string) => {
  const { recovery, costFirst, bridge, foundation, targetHash, forward } =
    readExpectedHistory(folder);

  await db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '120s'`);
    // The lock is transaction-scoped, including on any preflight/DDL failure.
    await tx.execute(sql`select pg_advisory_xact_lock(1835102820, 1)`);
    const state = await tx.execute<{
      journal: string | null;
      convergence: string | null;
      has_objects: boolean;
    }>(sql`
      select to_regclass('drizzle.__drizzle_migrations')::text as journal,
        to_regclass('drizzle.__dipbot_convergence')::text as convergence,
        exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relkind in ('r','p','v','m','S')) as has_objects
    `);
    const catalog = state.rows[0];
    if (!catalog) throw new Error("MIGRATION_CATALOG_UNAVAILABLE");
    if (!catalog.journal && (catalog.has_objects || catalog.convergence)) {
      throw new Error("MIGRATION_UNJOURNALLED_DATABASE");
    }
    const rows = catalog.journal
      ? (
          await tx.execute<Applied>(sql`
          select hash, created_at from drizzle.__drizzle_migrations order by id
        `)
        ).rows
      : [];
    if (catalog.has_objects && rows.length === 0) {
      throw new Error("MIGRATION_EMPTY_JOURNAL_WITH_SCHEMA");
    }
    const lineage = recognizeMigrationHistory(rows, recovery, costFirst);
    const history = lineage === "recovery" ? recovery : costFirst;
    if (catalog.convergence) {
      const marker = await tx.execute<{
        source_history: string;
        target: string;
        target_hash: string;
      }>(
        sql`select source_history, target, target_hash from drizzle.__dipbot_convergence`,
      );
      if (
        rows.length !== history.length ||
        marker.rows.length !== 1 ||
        marker.rows[0]?.source_history !== lineage ||
        marker.rows[0]?.target !== CONVERGED_CATALOG ||
        marker.rows[0]?.target_hash !== targetHash
      ) {
        throw new Error("MIGRATION_CONVERGENCE_RECORD_MISMATCH");
      }
      await assertTenantCatalog(tx);
      await applyForwardMigrations(tx, forward);
      await assertReservationCatalog(tx);
      return;
    }

    await tx.execute(sql`create schema if not exists drizzle`);
    await tx.execute(sql`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key, hash text not null, created_at bigint
      )
    `);
    for (const migration of history.slice(rows.length)) {
      for (const statement of migration.sql) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`
        insert into drizzle.__drizzle_migrations(hash,created_at)
        values(${migration.hash},${migration.folderMillis})
      `);
    }
    if (lineage === "cost-first") await executeFile(tx, bridge);
    await executeFile(tx, foundation);
    await tx.execute(sql`
      create table drizzle.__dipbot_convergence (
        target text primary key, source_history text not null,
        target_hash text not null, completed_at timestamptz not null default now()
      )
    `);
    await tx.execute(sql`
      insert into drizzle.__dipbot_convergence(target,source_history,target_hash)
      values(${CONVERGED_CATALOG},${lineage},${targetHash})
    `);
    await assertTenantCatalog(tx);
    await applyForwardMigrations(tx, forward);
    await assertReservationCatalog(tx);
  });
};
