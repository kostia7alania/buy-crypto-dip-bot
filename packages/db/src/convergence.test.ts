import { randomBytes } from "node:crypto";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    it("applies later SQL to both lineages once and rejects edited or failed forward migrations", async () => {
      const fixture = mkdtempSync(path.join(tmpdir(), "dipbot-forward-"));
      cpSync(folder, fixture, { recursive: true });
      const journal = path.join(fixture, "forward/meta/_journal.json");
      const migration = path.join(fixture, "forward/0000_contract_probe.sql");
      writeFileSync(
        journal,
        JSON.stringify({
          version: "7",
          dialect: "postgresql",
          entries: [
            {
              idx: 0,
              version: "7",
              when: 1789344000000,
              tag: "0000_contract_probe",
              breakpoints: true,
            },
          ],
        }),
      );
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
          ).toBe("1");
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
