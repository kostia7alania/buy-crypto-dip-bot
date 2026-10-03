import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginStartup,
  markDatabaseReady,
  markRunnerDisabled,
  markStopping,
} from "../../runtime-readiness.js";
import {
  createDatabaseReadinessProbe,
  DATABASE_READINESS_CACHE_MS,
} from "./database-readiness.js";
import { createHealthRoutes } from "./health.route.js";

afterEach(() => vi.useRealTimers());

describe("live database readiness", () => {
  it("shares an active probe, caches failure, and recovers after expiry", async () => {
    vi.useFakeTimers();
    const gate = Promise.withResolvers<boolean>();
    const probe = vi.fn(() => gate.promise);
    const check = createDatabaseReadinessProbe("fixture-only", probe);
    const first = check();
    expect(check()).toBe(first);
    expect(probe).toHaveBeenCalledOnce();
    gate.resolve(false);
    expect(await first).toBe(false);
    expect(await check()).toBe(false);
    expect(probe).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(DATABASE_READINESS_CACHE_MS);
    probe.mockResolvedValue(true);
    expect(await check()).toBe(true);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("returns 503 for lost DB connectivity without changing process liveness", async () => {
    beginStartup();
    markDatabaseReady();
    markRunnerDisabled();
    const checkDatabase = vi.fn(async () => false);
    const app = createHealthRoutes({
      checkDatabase,
      allowUncredentialedLocalHeartbeat: false,
    });
    const failed = await app.request("/ready");
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect(await failed.json()).toMatchObject({
      state: "failed",
      database: "failed",
    });
    expect((await app.request("/")).status).toBe(200);
    checkDatabase.mockResolvedValue(true);
    expect((await app.request("/ready")).status).toBe(200);
  });

  it("does not restore readiness if shutdown begins during a successful probe", async () => {
    beginStartup();
    markDatabaseReady();
    markRunnerDisabled();
    const gate = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<void>();
    const app = createHealthRoutes({
      checkDatabase: () => {
        entered.resolve();
        return gate.promise;
      },
      allowUncredentialedLocalHeartbeat: false,
    });
    const pending = app.request("/ready");
    await entered.promise;
    markStopping();
    gate.resolve(true);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ state: "stopping" });
  });
});
