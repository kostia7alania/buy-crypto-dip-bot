import { afterEach, describe, expect, it, vi } from "vitest";

const { db, end, migrate } = vi.hoisted(() => ({
  db: { select: vi.fn() },
  end: vi.fn().mockResolvedValue(undefined),
  migrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@buy-crypto-dip-bot/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@buy-crypto-dip-bot/db")>()),
  createPostgresConnection: () => ({ db, pool: { end } }),
  runMigrations: migrate,
}));

import { getRunnerStatus, startRunner } from "./runner.service.js";

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
});
