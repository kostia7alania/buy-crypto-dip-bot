import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, end, migrate } = vi.hoisted(() => ({
  db: { select: vi.fn(), delete: vi.fn() },
  end: vi.fn().mockResolvedValue(undefined),
  migrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@buy-crypto-dip-bot/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@buy-crypto-dip-bot/db")>()),
  createPostgresConnection: () => ({ db, pool: { end } }),
  runMigrations: migrate,
}));

import { getRunnerStatus, startRunner } from "./runner.service.js";

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("runner kill switch", () => {
  it("migrates but does not seed, poll, fetch or register timers when disabled", async () => {
    vi.stubEnv("OPERATOR_TELEGRAM_USER_ID", "disabled-runner-owner");
    const interval = vi.spyOn(globalThis, "setInterval");
    const fetch = vi.spyOn(globalThis, "fetch");
    const onMigrationsComplete = vi.fn(() => {
      expect(migrate).toHaveBeenCalledWith(db);
    });

    await startRunner({
      connectionString: "postgresql://unused.invalid/review",
      enabled: false,
      onMigrationsComplete,
    });

    expect(onMigrationsComplete).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    expect(db.select).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(getRunnerStatus()).toMatchObject({
      lastTickAt: null,
      tickIntervalMs: 0,
      sessionCleanup: { lastCompletedAt: null, intervalMs: 0 },
    });
  });

  it("drains a running migration but admits no startup work after cancellation", async () => {
    vi.stubEnv("OPERATOR_TELEGRAM_USER_ID", "cancelled-runner-owner");
    const migration = Promise.withResolvers<void>();
    migrate.mockReturnValueOnce(migration.promise);
    const interval = vi.spyOn(globalThis, "setInterval");
    const fetch = vi.spyOn(globalThis, "fetch");
    const controller = new AbortController();
    const starting = startRunner({
      connectionString: "postgresql://unused.invalid/review",
      enabled: true,
      signal: controller.signal,
    });
    controller.abort();
    expect(end).not.toHaveBeenCalled();
    migration.resolve();
    const runner = await starting;
    await runner.stop();
    expect(end).toHaveBeenCalledOnce();
    expect(db.select).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
