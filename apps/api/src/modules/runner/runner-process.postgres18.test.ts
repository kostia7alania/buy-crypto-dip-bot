import { type ChildProcess, fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  createPostgresConnection,
  runMigrations,
  schema,
} from "@buy-crypto-dip-bot/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const testUrl = process.env.POSTGRES18_TEST_URL;
if (process.env.REQUIRE_POSTGRES18_TEST === "1" && !testUrl) {
  throw new Error("POSTGRES18_TEST_URL_REQUIRED");
}

const describePostgres18 = testUrl ? describe : describe.skip;
const databaseName = `dipbot_runner_process_${process.pid}_${randomBytes(4).toString("hex")}`;
type Connection = ReturnType<typeof createPostgresConnection>;
interface Worker {
  child: ChildProcess;
  applicationName: string;
  output: () => string;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}
const workers: Worker[] = [];
let admin: Connection;
let observer: Connection;
let databaseUrl: string;
let databaseCreated = false;

const startProcess = async (mode: "reserve" | "runner") => {
  const applicationName = `pg18_runner_process_${mode}_${workers.length}`;
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", applicationName);
  const child = fork(
    new URL("./runner-process.postgres18.fixture.ts", import.meta.url),
    [mode],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      execArgv: ["--import", "tsx"],
      // Do not inherit operator IDs, bot tokens, DB defaults or Node preload hooks.
      env: { POSTGRES18_TEST_URL: url.toString(), NODE_ENV: "test" },
      silent: true,
    },
  );
  let output = "";
  let ready = false;
  let spawnError: Error | undefined;
  child.stdout?.on("data", (chunk) => {
    output = (output + String(chunk)).slice(-12_000);
  });
  child.stderr?.on("data", (chunk) => {
    output = (output + String(chunk)).slice(-12_000);
  });
  child.on("message", (message) => {
    if (message === mode) ready = true;
  });
  child.on("error", (error) => {
    spawnError = error;
  });
  const worker: Worker = {
    child,
    applicationName,
    output: () => output,
    closed: new Promise((resolve) => {
      child.once("close", (code, signal) => resolve({ code, signal }));
    }),
  };
  workers.push(worker);
  await vi.waitFor(
    () => {
      expect(spawnError, output).toBeUndefined();
      expect(child.exitCode, output).toBeNull();
      expect(child.signalCode, output).toBeNull();
      expect(ready, output).toBe(true);
    },
    { timeout: 15_000, interval: 25 },
  );
  return worker;
};

const killProcess = async (worker: Worker) => {
  if (worker.child.exitCode === null && worker.child.signalCode === null) {
    worker.child.kill("SIGKILL");
  }
  return worker.closed;
};

// All three reads share one committed snapshot: a partial settlement must fail.
const readLedger = () =>
  observer.db.transaction(
    async (tx) => ({
      orders: await tx.select().from(schema.orders),
      reservations: await tx.select().from(schema.orderReservations),
      events: await tx
        .select()
        .from(schema.auditEvents)
        .orderBy(schema.auditEvents.createdAt, schema.auditEvents.id),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );

describePostgres18("PostgreSQL 18 runner process recovery", () => {
  beforeAll(async () => {
    admin = createPostgresConnection(testUrl as string);
    const version = await admin.pool.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(
      180_000,
    );
    expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(190_000);
    await admin.pool.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const url = new URL(testUrl as string);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();
    observer = createPostgresConnection(databaseUrl);
    await runMigrations(observer.db);
  }, 60_000);

  afterAll(async () => {
    for (const worker of workers) await killProcess(worker);
    if (observer) await observer.pool.end();
    if (admin) {
      try {
        if (databaseCreated) {
          // pool.end() can resolve before PostgreSQL sees the socket close.
          await vi.waitFor(
            async () => {
              const result = await admin.pool.query<{ connections: number }>(
                "SELECT count(*)::int AS connections FROM pg_stat_activity WHERE datname = $1",
                [databaseName],
              );
              expect(result.rows[0]?.connections).toBe(0);
            },
            { timeout: 5_000, interval: 25 },
          );
          await admin.pool.query(`DROP DATABASE "${databaseName}"`);
        }
      } finally {
        await admin.pool.end();
      }
    }
  }, 15_000);

  it("discovers a reservation after SIGKILL and settles once across competing fresh runners", async () => {
    const reserving = await startProcess("reserve");
    const pending = await readLedger();
    expect(pending.orders).toEqual([
      expect.objectContaining({ status: "PENDING", mode: "DRY_RUN" }),
    ]);
    const order = pending.orders[0];
    if (!order) throw new Error("RUNNER_PROCESS_PENDING_ORDER_MISSING");
    expect(order.executeAt?.getTime()).toBeLessThanOrEqual(Date.now());
    expect(pending.reservations).toEqual([
      expect.objectContaining({
        orderId: order.id,
        userId: order.userId,
        quoteAmount: order.quoteAmount,
        status: "ACTIVE",
        resolvedAt: null,
      }),
    ]);
    expect(pending.events).toEqual([
      expect.objectContaining({ action: "RISK_DECISION_APPROVED" }),
    ]);
    expect(await killProcess(reserving)).toEqual({
      code: null,
      signal: "SIGKILL",
    });
    expect(await readLedger()).toEqual(pending);

    const lock = await observer.pool.connect();
    let first: Worker;
    let second: Worker;
    try {
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM orders WHERE id = $1 FOR UPDATE", [
        order.id,
      ]);
      first = await startProcess("runner");
      second = await startProcess("runner");
      expect(
        new Set([reserving.child.pid, first.child.pid, second.child.pid]).size,
      ).toBe(3);
      // Both real scheduler loops must discover and attempt this same row.
      // Waiting for database locks, not sleeps, makes the claim race mandatory.
      await vi.waitFor(
        async () => {
          const result = await observer.pool.query<{ waiting: number }>(
            `SELECT count(DISTINCT application_name)::int AS waiting
             FROM pg_stat_activity
             WHERE datname = $1 AND application_name = ANY($2::text[])
               AND wait_event_type = 'Lock'
               AND lower(query) LIKE 'update "orders"%'
               AND cardinality(pg_blocking_pids(pid)) > 0`,
            [databaseName, [first.applicationName, second.applicationName]],
          );
          expect(
            result.rows[0]?.waiting,
            first.output() + second.output(),
          ).toBe(2);
        },
        { timeout: 15_000, interval: 25 },
      );
      expect(await readLedger()).toEqual(pending);
      await lock.query("COMMIT");
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }

    let settled = await readLedger();
    const deadline = Date.now() + 15_000;
    while (settled.orders[0]?.status === "PENDING" && Date.now() < deadline) {
      expect(settled).toEqual(pending);
      await delay(25);
      settled = await readLedger();
    }
    expect(settled).toEqual({
      orders: [{ ...order, status: "COMPLETED" }],
      reservations: [
        {
          ...pending.reservations[0],
          status: "CONSUMED",
          resolvedAt: expect.any(Date),
        },
      ],
      events: [
        ...pending.events,
        expect.objectContaining({
          action: "DRY_RUN_ORDER_COMPLETED",
          entityId: order.id,
          userId: order.userId,
          reasonCode: "SCHEDULE_DUE",
          actorChannel: "RUNNER",
          payload: { from: "PENDING", to: "COMPLETED", mode: "DRY_RUN" },
        }),
      ],
    });

    // Wait for both claims to finish before another cold start checks replay.
    await vi.waitFor(
      async () => {
        const result = await observer.pool.query<{ busy: number }>(
          `SELECT count(*)::int AS busy FROM pg_stat_activity
           WHERE datname = $1 AND application_name = ANY($2::text[])
             AND state <> 'idle'`,
          [databaseName, [first.applicationName, second.applicationName]],
        );
        expect(result.rows[0]?.busy).toBe(0);
      },
      { timeout: 15_000, interval: 25 },
    );
    for (const worker of [first, second]) {
      expect(worker.child.exitCode, worker.output()).toBeNull();
      expect(worker.child.signalCode, worker.output()).toBeNull();
      expect(worker.output()).not.toMatch(/"level":"ERROR"/);
      await killProcess(worker);
    }
    expect(await readLedger()).toEqual(settled);

    const replay = await startProcess("runner");
    await vi.waitFor(
      async () => {
        const result = await observer.pool.query<{ polled: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM pg_stat_activity
             WHERE datname = $1 AND application_name = $2 AND state = 'idle'
               AND lower(query) LIKE 'select %from "orders" where%'
           ) AS polled`,
          [databaseName, replay.applicationName],
        );
        expect(result.rows[0]?.polled, replay.output()).toBe(true);
      },
      { timeout: 15_000, interval: 25 },
    );
    expect(await readLedger()).toEqual(settled);
    expect(replay.output()).not.toMatch(/"level":"ERROR"/);
  }, 60_000);
});
