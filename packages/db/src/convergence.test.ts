import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createPostgresConnection } from "./adapters.js";
import {
  migrateKnownHistory,
  recognizeMigrationHistory,
} from "./migration-history.js";
import { withPersonalTenant } from "./tenant-context.js";

const folder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
const recovery = readMigrationFiles({ migrationsFolder: folder });
const costFirstFolder = path.join(folder, "histories/cost-first");
const costFirst = readMigrationFiles({ migrationsFolder: costFirstFolder });
const forward = readMigrationFiles({
  migrationsFolder: path.join(folder, "forward"),
});
const applied = (history: typeof recovery) =>
  history.map((m) => ({ hash: m.hash, created_at: m.folderMillis }));

describe("migration history identity", () => {
  it("recognizes both exact histories and shared prefixes", () => {
    expect(recognizeMigrationHistory([], recovery, costFirst)).toBe("recovery");
    expect(
      recognizeMigrationHistory(applied(recovery), recovery, costFirst),
    ).toBe("recovery");
    expect(
      recognizeMigrationHistory(applied(costFirst), recovery, costFirst),
    ).toBe("cost-first");
    expect(
      recognizeMigrationHistory(
        applied(costFirst.slice(0, 2)),
        recovery,
        costFirst,
      ),
    ).toBe("recovery");
  });
  it("refuses edited, mixed, reordered or missing history entries", () => {
    const rows = applied(recovery);
    for (const invalid of [
      rows.slice(1),
      [...rows].reverse(),
      [...rows, ...applied(costFirst.slice(2))],
      rows.map((row, i) => (i === 2 ? { ...row, hash: "modified" } : row)),
      rows.map((row, i) =>
        i === 2 ? { ...row, created_at: row.created_at + 1 } : row,
      ),
    ])
      expect(() =>
        recognizeMigrationHistory(invalid, recovery, costFirst),
      ).toThrow("MIGRATION_HISTORY_UNKNOWN_OR_MODIFIED");
  });
});

const testUrl = process.env.POSTGRES18_TEST_URL;
const suffix = randomBytes(5).toString("hex");
const connections: ReturnType<typeof createPostgresConnection>[] = [];
const databases: string[] = [];
const admin = testUrl ? new pg.Pool({ connectionString: testUrl }) : null;
const fresh = async () => {
  if (!admin || !testUrl) throw new Error("POSTGRES18_TEST_URL_REQUIRED");
  const name = `dipbot_convergence_${suffix}_${databases.length}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  databases.push(name);
  const url = new URL(testUrl);
  url.pathname = `/${name}`;
  const connection = createPostgresConnection(url.toString());
  connections.push(connection);
  return connection;
};

// Reproduce the released 0000 catalog and its journals without invoking the
// current runner, whose postflight requires the new forward protections.
const reservationV0 = async (history: "recovery" | "cost-first") => {
  const connection = await fresh();
  await migrate(connection.db, {
    migrationsFolder: history === "recovery" ? folder : costFirstFolder,
  });
  const bridge = readFileSync(
    path.join(folder, "convergence/cost-first-to-recovery.sql"),
    "utf8",
  );
  const foundation = readFileSync(
    path.join(folder, "convergence/tenant-foundation.sql"),
    "utf8",
  );
  const digest = (text: string) =>
    createHash("sha256").update(text).digest("hex");
  const first = forward[0];
  if (!first) throw new Error("RESERVATION_MIGRATION_REQUIRED");
  await connection.db.transaction(async (tx) => {
    for (const contents of [
      ...(history === "cost-first" ? [bridge] : []),
      foundation,
      first.sql.join("--> statement-breakpoint"),
    ]) {
      for (const statement of contents.split("--> statement-breakpoint"))
        if (statement.trim()) await tx.execute(sql.raw(statement));
    }
    await tx.execute(sql`create table drizzle.__dipbot_convergence (
      target text primary key, source_history text not null,
      target_hash text not null, completed_at timestamptz not null default now()
    ); create table drizzle.__dipbot_forward_migrations (
      id serial primary key, hash text not null, created_at bigint not null
    )`);
    await tx.execute(sql`insert into drizzle.__dipbot_convergence(target,source_history,target_hash)
      values('gate1_tenants_v1',${history},${digest(JSON.stringify([digest(bridge), digest(foundation)]))})`);
    await tx.execute(sql`insert into drizzle.__dipbot_forward_migrations(hash,created_at)
      values(${first.hash},${first.folderMillis})`);
  });
  return connection;
};

const alice = "aaaaaaaa-0000-4000-8000-000000000001";
const bob = "bbbbbbbb-0000-4000-8000-000000000002";
const btc = "11111111-0000-4000-8000-000000000001";
const eth = "22222222-0000-4000-8000-000000000002";
const seedReservationOwners = async (
  connection: ReturnType<typeof createPostgresConnection>,
) => {
  await connection.pool.query(`insert into users(id,telegram_user_id) values
    ('${alice}','111'),('${bob}','222');
    insert into strategies(id,user_id,name,symbol,config) values
    ('${btc}','${alice}','BTC','BTCUSDT','{}'),
    ('${eth}','${alice}','ETH','ETHUSDT','{}')`);
};
afterAll(async () => {
  for (const connection of connections) await connection.pool.end();
  for (const database of databases)
    await admin?.query(`DROP DATABASE "${database}"`);
  await admin?.end();
});

const seedLegacy = async (
  db: ReturnType<typeof createPostgresConnection>["db"],
) => {
  await db.execute(sql`
    insert into users(id,telegram_user_id,telegram_chat_id) values
      ('aaaaaaaa-0000-4000-8000-000000000001','111','111'),
      ('bbbbbbbb-0000-4000-8000-000000000002','222','222');
    insert into strategies(id,user_id,name,symbol,config) values
      ('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','A BTC','BTCUSDT','{}'),
      ('22222222-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','B BTC','BTCUSDT','{}');
    insert into orders(id,strategy_id,symbol,side,quote_amount,status) values
      ('33333333-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','BTCUSDT','BUY',123.456789,'COMPLETED');
    insert into audit_events(id,entity_type,entity_id,action,payload) values
      ('44444444-0000-4000-8000-000000000001','order','33333333-0000-4000-8000-000000000001','LEGACY','{"original":"unchanged"}');
  `);
};

const catalogOf = async (
  connection: ReturnType<typeof createPostgresConnection>,
) => {
  const [columns, constraints, indexes, policies, triggers] = await Promise.all(
    [
      connection.pool.query(
        `select table_name,column_name,is_nullable,data_type,column_default from information_schema.columns where table_schema='public' order by table_name,column_name`,
      ),
      connection.pool.query(
        `select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname`,
      ),
      connection.pool.query(
        `select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`,
      ),
      connection.pool.query(
        `select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname`,
      ),
      connection.pool.query(
        `select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname`,
      ),
    ],
  );
  return {
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
    policies: policies.rows,
    triggers: triggers.rows,
  };
};

(testUrl ? describe : describe.skip)(
  "PostgreSQL 18 history convergence",
  () => {
    it("rejects mismatched/nonfinite holds and freezes reserved economics without blocking delivery or settlement", async () => {
      const connection = await fresh();
      await migrateKnownHistory(connection.db, folder);
      await seedReservationOwners(connection);
      const reserve = async (
        strategyId = btc,
        reservationAmount = "100",
        orderAmount = "100",
      ) => {
        const id = randomUUID();
        await withPersonalTenant(connection.db, alice, async (tx) => {
          await tx.execute(sql`insert into orders(id,user_id,strategy_id,symbol,side,quote_amount,status)
            values(${id},${alice},${btc},'BTCUSDT','BUY',${orderAmount},'PENDING')`);
          await tx.execute(sql`insert into order_reservations(user_id,strategy_id,order_id,quote_amount,
            policy_version,config_revision,strategy_config,market_snapshot_key,market_snapshot,risk_snapshot)
            values(${alice},${strategyId},${id},${reservationAmount},'TEST','test','{}','test','{}','{}')`);
        });
        return id;
      };
      for (const [strategyId, amount] of [
        [eth, "100"],
        [btc, "1"],
      ]) {
        await expect(reserve(strategyId, amount)).rejects.toMatchObject({
          cause: { constraint: "order_reservations_order_economics_fk" },
        });
      }
      for (const amount of ["NaN", "Infinity", "-Infinity"]) {
        await expect(reserve(btc, amount)).rejects.toMatchObject({
          cause: { constraint: "order_reservations_quote_positive_check" },
        });
        await expect(reserve(btc, "100", amount)).rejects.toMatchObject({
          cause: { constraint: "orders_quote_finite_check" },
        });
      }

      const id = await reserve();
      for (const assignment of [
        `id='${randomUUID()}'`,
        `strategy_id='${eth}'`,
        "quote_amount=1000",
        "symbol='ETHUSDT'",
        "mode='LIVE'",
        "side='SELL'",
        "price=1",
        `risk_decision_id='${randomUUID()}'`,
        "evaluation_key='changed'",
        "created_at=created_at-interval '1 day'",
      ]) {
        await expect(
          withPersonalTenant(connection.db, alice, (tx) =>
            tx.execute(
              sql`update orders set ${sql.raw(assignment)} where id=${id}`,
            ),
          ),
        ).rejects.toMatchObject({
          cause: { message: "RESERVED_ORDER_EVIDENCE_IMMUTABLE" },
        });
      }
      await withPersonalTenant(connection.db, bob, async (tx) => {
        expect(
          (await tx.execute(sql`select id from order_reservations`)).rows,
        ).toEqual([]);
      });
      await withPersonalTenant(connection.db, alice, async (tx) => {
        await tx.execute(sql`update orders set execute_at=now(),tg_message_id=123,tg_chat_id='111',
          quote_amount=quote_amount where id=${id}`);
        await tx.execute(
          sql`update orders set status='COMPLETED' where id=${id}`,
        );
        expect(
          (
            await tx.execute(sql`select status,resolved_at is not null as resolved
          from order_reservations where order_id=${id}`)
          ).rows,
        ).toEqual([{ status: "CONSUMED", resolved: true }]);
      });
      await expect(
        withPersonalTenant(connection.db, alice, (tx) =>
          tx.execute(sql`update orders set quote_amount=0 where id=${id}`),
        ),
      ).rejects.toMatchObject({
        cause: { message: "RESERVED_ORDER_EVIDENCE_IMMUTABLE" },
      });
      await expect(
        withPersonalTenant(connection.db, alice, (tx) =>
          tx.execute(sql`update orders set status='CANCELLED' where id=${id}`),
        ),
      ).rejects.toThrow();
      const cancelledId = await reserve();
      await withPersonalTenant(connection.db, alice, async (tx) => {
        await tx.execute(
          sql`update orders set status='CANCELLED' where id=${cancelledId}`,
        );
        expect(
          (
            await tx.execute(
              sql`select status from order_reservations where order_id=${cancelledId}`,
            )
          ).rows,
        ).toEqual([{ status: "RELEASED" }]);
      });
      await expect(
        withPersonalTenant(connection.db, alice, (tx) =>
          tx.execute(
            sql`update orders set quote_amount=1 where id=${cancelledId}`,
          ),
        ),
      ).rejects.toMatchObject({
        cause: { message: "RESERVED_ORDER_EVIDENCE_IMMUTABLE" },
      });
    }, 60_000);

    it("upgrades either released reservation history without rewrites and rolls back invalid economics", async () => {
      for (const history of ["recovery", "cost-first"] as const) {
        for (const defect of [
          null,
          "amount",
          "strategy",
          "NaN",
          "Infinity",
        ] as const) {
          const connection = await reservationV0(history);
          await seedReservationOwners(connection);
          const id = randomUUID();
          const orderAmount =
            defect === "NaN" || defect === "Infinity" ? defect : "100";
          await connection.pool.query(`begin;
            insert into orders(id,user_id,strategy_id,symbol,side,quote_amount,status)
            values('${id}','${alice}','${btc}','BTCUSDT','BUY','${orderAmount}','PENDING');
            insert into order_reservations(user_id,strategy_id,order_id,quote_amount,
              policy_version,config_revision,strategy_config,market_snapshot_key,market_snapshot,risk_snapshot)
            values('${alice}','${defect === "strategy" ? eth : btc}','${id}',
              '${defect === "amount" ? "1" : orderAmount}','TEST','test','{}','test','{}','{}');
            commit`);
          const snapshot = async () =>
            (
              await connection.pool.query(`select
            (select jsonb_agg(to_jsonb(o)) from orders o) as orders,
            (select jsonb_agg(to_jsonb(r)) from order_reservations r) as reservations,
            (select jsonb_agg(to_jsonb(m) order by id) from drizzle.__drizzle_migrations m) as history,
            (select jsonb_agg(to_jsonb(m)) from drizzle.__dipbot_convergence m) as bridge`)
            ).rows;
          const before = await snapshot();
          if (defect) {
            await expect(
              migrateKnownHistory(connection.db, folder),
            ).rejects.toMatchObject({
              cause: {
                message:
                  defect === "amount" || defect === "strategy"
                    ? "MIGRATION_RESERVATION_ECONOMICS_MISMATCH"
                    : "MIGRATION_RESERVATION_AMOUNT_INVALID",
              },
            });
            expect(
              (
                await connection.pool.query(
                  `select count(*) from drizzle.__dipbot_forward_migrations`,
                )
              ).rows[0].count,
            ).toBe("1");
            expect(
              (
                await connection.pool.query(
                  `select to_regclass('orders_reservation_economics_idx') as index`,
                )
              ).rows[0].index,
            ).toBeNull();
          } else {
            await migrateKnownHistory(connection.db, folder);
            await migrateKnownHistory(connection.db, folder);
            expect(
              (
                await connection.pool.query(
                  `select count(*) from drizzle.__dipbot_forward_migrations`,
                )
              ).rows[0].count,
            ).toBe(String(forward.length));
          }
          expect(await snapshot()).toEqual(before);
        }
      }
    }, 60_000);

    it("serializes reservation attachment against a stale repeatable-read order edit", async () => {
      const connection = await fresh();
      await migrateKnownHistory(connection.db, folder);
      await seedReservationOwners(connection);
      const id = randomUUID();
      await connection.pool.query(`insert into orders(id,user_id,strategy_id,symbol,side,quote_amount,status)
        values('${id}','${alice}','${btc}','BTCUSDT','BUY',100,'COMPLETED')`);
      const editor = await connection.pool.connect();
      try {
        await editor.query("begin isolation level repeatable read");
        const tenant = (
          await editor.query(
            "select id from tenants where personal_owner_user_id=$1",
            [alice],
          )
        ).rows[0].id;
        await editor.query(
          "select set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",
          [alice, tenant],
        );
        await editor.query("set local role dipbot_app");
        expect(
          (await editor.query("select id from order_reservations")).rows,
        ).toEqual([]);
        await withPersonalTenant(connection.db, alice, (tx) =>
          tx.execute(sql`
          insert into order_reservations(user_id,strategy_id,order_id,quote_amount,status,resolved_at,
            policy_version,config_revision,strategy_config,market_snapshot_key,market_snapshot,risk_snapshot)
          values(${alice},${btc},${id},100,'CONSUMED',now(),'TEST','test','{}','test','{}','{}')`),
        );
        await expect(
          editor.query("update orders set symbol='ETHUSDT' where id=$1", [id]),
        ).rejects.toMatchObject({ code: "40001" });
      } finally {
        await editor.query("rollback");
        editor.release();
      }
      expect(
        (
          await connection.pool.query("select symbol from orders where id=$1", [
            id,
          ])
        ).rows,
      ).toEqual([{ symbol: "BTCUSDT" }]);
    }, 60_000);

    it("refuses missing reservation protections even with an intact forward journal", async () => {
      const connection = await fresh();
      await migrateKnownHistory(connection.db, folder);
      for (const change of [
        "alter table orders disable trigger orders_reserved_evidence_immutable",
        "alter table order_reservations disable row level security",
        "alter table order_reservations drop constraint order_reservations_order_economics_fk",
      ]) {
        await connection.pool.query(change);
        await expect(
          migrateKnownHistory(connection.db, folder),
        ).rejects.toThrow("MIGRATION_RESERVATION_CATALOG_DRIFT");
        if (change.includes("disable trigger"))
          await connection.pool.query(
            "alter table orders enable trigger orders_reserved_evidence_immutable",
          );
        if (change.includes("disable row"))
          await connection.pool.query(
            "alter table order_reservations enable row level security",
          );
      }
    }, 60_000);

    it("applies later SQL to both lineages once and rejects edited or failed forward migrations", async () => {
      const fixture = mkdtempSync(path.join(tmpdir(), "dipbot-forward-"));
      cpSync(folder, fixture, { recursive: true });
      const journal = path.join(fixture, "forward/meta/_journal.json");
      const migration = path.join(fixture, "forward/0002_contract_probe.sql");
      const manifest = JSON.parse(readFileSync(journal, "utf8"));
      manifest.entries.push({
        idx: manifest.entries.length,
        version: "7",
        when: 1790985600000,
        tag: "0002_contract_probe",
        breakpoints: true,
      });
      writeFileSync(journal, JSON.stringify(manifest));
      try {
        for (const history of [folder, costFirstFolder]) {
          const connection = await fresh();
          await migrate(connection.db, { migrationsFolder: history });
          writeFileSync(
            migration,
            "create table forward_contract_probe(id integer primary key);",
          );
          await migrateKnownHistory(connection.db, fixture);
          await migrateKnownHistory(connection.db, fixture);
          expect(
            (
              await connection.pool.query(
                "select count(*) from drizzle.__dipbot_forward_migrations",
              )
            ).rows[0].count,
          ).toBe(String(forward.length + 1));
          writeFileSync(migration, "create table changed_probe(id integer);");
          await expect(
            migrateKnownHistory(connection.db, fixture),
          ).rejects.toThrow("MIGRATION_FORWARD_HISTORY_UNKNOWN_OR_MODIFIED");
          expect(
            (
              await connection.pool.query(
                "select to_regclass('public.changed_probe') as probe",
              )
            ).rows[0].probe,
          ).toBeNull();
        }
        const failure = await fresh();
        writeFileSync(
          migration,
          "create table rollback_probe(id integer);\n--> statement-breakpoint\nselect 1/0;",
        );
        await expect(
          migrateKnownHistory(failure.db, fixture),
        ).rejects.toThrow();
        expect(
          (
            await failure.pool.query(
              "select to_regclass('public.rollback_probe') as probe,to_regnamespace('drizzle') as journal",
            )
          ).rows[0],
        ).toEqual({ probe: null, journal: null });
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    }, 60_000);

    it("enforces tenant isolation using a reused physical connection, including after rollback", async () => {
      const connection = await fresh();
      connection.pool.options.max = 1;
      await migrateKnownHistory(connection.db, folder);
      await connection.pool.query(`insert into users(id,telegram_user_id) values
      ('aaaaaaaa-0000-4000-8000-000000000001','111'),('bbbbbbbb-0000-4000-8000-000000000002','222');
      insert into strategies(user_id,name,symbol,config) select id,telegram_user_id,'BTCUSDT','{}' from users`);
      const alice = "aaaaaaaa-0000-4000-8000-000000000001";
      const bob = "bbbbbbbb-0000-4000-8000-000000000002";
      const readOwned = (userId: string) =>
        withPersonalTenant(connection.db, userId, async (tx) => {
          const role = await tx.execute(
            sql`select current_user,rolsuper,rolbypassrls from pg_roles where rolname=current_user`,
          );
          expect(role.rows[0]).toMatchObject({
            current_user: "dipbot_app",
            rolsuper: false,
            rolbypassrls: false,
          });
          return (await tx.execute(sql`select user_id from strategies`)).rows;
        });
      expect(await readOwned(alice)).toEqual([{ user_id: alice }]);
      await expect(
        withPersonalTenant(connection.db, alice, async (tx) => {
          await tx.execute(
            sql`insert into strategies(user_id,name,symbol,config) values(${bob},'forged','ETHUSDT','{}')`,
          );
        }),
      ).rejects.toThrow();
      expect(await readOwned(bob)).toEqual([{ user_id: bob }]);
      await connection.db.transaction(async (tx) => {
        await tx.execute(sql`set local role dipbot_app`);
        expect((await tx.execute(sql`select id from strategies`)).rows).toEqual(
          [],
        );
      });
      const restored = (
        await connection.pool.query(
          "select current_user,current_setting('app.user_id',true) as owner",
        )
      ).rows[0];
      expect(restored.current_user).toBe("postgres");
      expect(restored.owner || null).toBeNull();
      expect(
        (await connection.pool.query("select count(*) from strategies")).rows[0]
          .count,
      ).toBe("2");
    }, 60_000);

    it("refuses unresolved main ownership atomically, preserving quarantine and the journal", async () => {
      const connection = await fresh();
      await migrate(connection.db, { migrationsFolder: costFirstFolder });
      await connection.pool.query(`insert into strategies(tenant_id,name,symbol,config)
      values('00000000-0000-4000-8000-000000000022','Unresolved original','BTCUSDT','{"original":true}')`);
      const before = (
        await connection.pool.query(
          "select to_jsonb(s) as row from strategies s",
        )
      ).rows;
      const journal = (
        await connection.pool.query(
          "select * from drizzle.__drizzle_migrations order by id",
        )
      ).rows;
      await expect(
        migrateKnownHistory(connection.db, folder),
      ).rejects.toThrow();
      expect(
        (
          await connection.pool.query(
            "select to_jsonb(s) as row from strategies s",
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await connection.pool.query(
            "select * from drizzle.__drizzle_migrations order by id",
          )
        ).rows,
      ).toEqual(journal);
      expect(
        (
          await connection.pool.query(
            "select to_regclass('public.api_sessions') as sessions,to_regclass('drizzle.__dipbot_convergence') as marker",
          )
        ).rows[0],
      ).toEqual({ sessions: null, marker: null });
    }, 60_000);

    it("refuses disabled tenant protection even when the migration journal is intact", async () => {
      const connection = await fresh();
      await migrateKnownHistory(connection.db, folder);
      await connection.pool.query(
        "alter table orders disable row level security",
      );
      await expect(migrateKnownHistory(connection.db, folder)).rejects.toThrow(
        "MIGRATION_TENANT_CATALOG_DRIFT",
      );
    }, 60_000);

    it("refuses tampered journals and bridge records before making another schema change", async () => {
      const connection = await fresh();
      await migrateKnownHistory(connection.db, folder);
      await connection.pool.query(
        "update drizzle.__dipbot_convergence set target_hash='modified'",
      );
      await expect(migrateKnownHistory(connection.db, folder)).rejects.toThrow(
        "MIGRATION_CONVERGENCE_RECORD_MISMATCH",
      );
      await connection.pool.query(
        "update drizzle.__drizzle_migrations set hash='modified' where id=3",
      );
      await expect(migrateKnownHistory(connection.db, folder)).rejects.toThrow(
        "MIGRATION_HISTORY_UNKNOWN_OR_MODIFIED",
      );
      expect(
        (
          await connection.pool.query(
            "select count(*) from drizzle.__dipbot_convergence",
          )
        ).rows[0].count,
      ).toBe("1");
    }, 60_000);
    it("converges clean, recovery and cost-first catalogs without rewriting original audit fields", async () => {
      const clean = await fresh();
      const main = await fresh();
      const local = await fresh();
      await migrateKnownHistory(clean.db, folder);
      await migrate(local.db, { migrationsFolder: folder });
      await local.db.execute(sql`insert into users(id,telegram_user_id) values ('aaaaaaaa-0000-4000-8000-000000000001','111');
      insert into audit_events(schema_version,user_id,entity_type,entity_id,action,payload) values(0,'aaaaaaaa-0000-4000-8000-000000000001','user','A','LEGACY','{"original":true}')`);
      const originalLocal = await local.pool.query(
        "select to_jsonb(a) as row from audit_events a",
      );
      await migrateKnownHistory(local.db, folder);
      const afterLocal = await local.pool.query(
        "select to_jsonb(a) - 'tenant_id' - 'event_key' as row from audit_events a",
      );
      expect(afterLocal.rows).toEqual(originalLocal.rows);
      // Build a genuine earlier main database with rows, then run its exact 0002.
      await main.db.execute(
        sql`create schema drizzle;create table drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint)`,
      );
      for (const migration of costFirst.slice(0, 2)) {
        for (const statement of migration.sql)
          if (statement.trim()) await main.db.execute(sql.raw(statement));
        await main.db.execute(
          sql`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migration.hash},${migration.folderMillis})`,
        );
      }
      await seedLegacy(main.db);
      await migrate(main.db, { migrationsFolder: costFirstFolder });
      const originalMain = await main.pool.query(
        "select to_jsonb(a) as row from audit_events a",
      );
      const originalJournal = await main.pool.query(
        "select * from drizzle.__drizzle_migrations order by id",
      );
      await migrateKnownHistory(main.db, folder);
      const afterMain = await main.pool.query(
        "select to_jsonb(a) - ARRAY['user_id','schema_version','scope','actor_kind','actor_channel','reason_code','correlation_id','payload_class'] as row from audit_events a",
      );
      expect(afterMain.rows).toEqual(originalMain.rows);
      expect(
        (
          await main.pool.query(
            "select * from drizzle.__drizzle_migrations order by id",
          )
        ).rows,
      ).toEqual(originalJournal.rows);
      expect(
        (await main.pool.query("select quote_amount from orders")).rows[0]
          ?.quote_amount,
      ).toBe("123.456789");
      expect(await catalogOf(main)).toEqual(await catalogOf(clean));
      expect(await catalogOf(local)).toEqual(await catalogOf(clean));
      await expect(
        main.pool.query("delete from audit_events"),
      ).rejects.toMatchObject({ message: "AUDIT_EVENT_IMMUTABLE" });
      await migrateKnownHistory(main.db, folder);
      expect(
        (
          await main.pool.query(
            "select count(*) from drizzle.__dipbot_convergence",
          )
        ).rows[0]?.count,
      ).toBe("1");
    }, 60_000);

    it("serializes concurrent startup and refuses unjournalled schemas without writes", async () => {
      const db = await fresh();
      await Promise.all([
        migrateKnownHistory(db.db, folder),
        migrateKnownHistory(db.db, folder),
      ]);
      expect(
        (
          await db.pool.query(
            "select count(*) from drizzle.__dipbot_convergence",
          )
        ).rows[0]?.count,
      ).toBe("1");
      const unknown = await fresh();
      await unknown.pool.query("create table valuable_evidence(id integer)");
      await expect(migrateKnownHistory(unknown.db, folder)).rejects.toThrow(
        "MIGRATION_UNJOURNALLED_DATABASE",
      );
      expect(
        (
          await unknown.pool.query(
            "select to_regnamespace('drizzle') as schema",
          )
        ).rows[0]?.schema,
      ).toBeNull();
    }, 60_000);
  },
);
