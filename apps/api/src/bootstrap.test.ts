import { describe, expect, it, vi } from "vitest";
import { prepareApi } from "./bootstrap.js";
import { getRuntimeReadiness, markStopping } from "./runtime-readiness.js";

vi.mock("./modules/health/database-readiness.js", () => ({
  createDatabaseReadinessProbe: () => async () => true,
}));

const env = (): NodeJS.ProcessEnv => ({
  APP_RUNTIME: "non-local",
  API_KEY: "service-key-for-a-non-local-deployment",
  BOT_HEARTBEAT_SECRET:
    "bot-heartbeat-secret-for-a-non-local-deployment-1234567890",
  POSTGRES_CONNECTION_STRING: "postgresql://app:secret@db:5432/dipbot",
  TELEGRAM_BOT_TOKEN: "123456:test-token",
  EXECUTION_MODE: "DRY_RUN",
  RUNNER_ENABLED: "true",
});

describe("API bootstrap ordering", () => {
  it("forwards cancellation during pending startup without restoring readiness", async () => {
    const controller = new AbortController();
    const initialization = Promise.withResolvers<void>();
    const runnerHandle = { stop: vi.fn(async () => {}) };
    const startBackgroundRunner = vi.fn(
      async (options: {
        signal?: AbortSignal;
        onMigrationsComplete?: () => void;
      }) => {
        expect(options.signal).toBe(controller.signal);
        expect(options.signal?.aborted).toBe(false);
        await initialization.promise;
        expect(options.signal?.aborted).toBe(true);
        options.onMigrationsComplete?.();
        return runnerHandle;
      },
    );
    const preparation = prepareApi({
      env: { APP_RUNTIME: "local", RUNNER_ENABLED: "true" },
      signal: controller.signal,
      startBackgroundRunner,
    });

    markStopping();
    controller.abort();
    expect(getRuntimeReadiness().state).toBe("stopping");
    initialization.resolve();

    const { app, runner } = await preparation;
    expect(runner).toBe(runnerHandle);
    expect(runner.stop).not.toHaveBeenCalled();
    expect(getRuntimeReadiness().state).toBe("stopping");
    expect((await app.request("/health/ready")).status).toBe(503);
  });

  it("becomes ready only after migration and runner initialization finish", async () => {
    const events: string[] = [];
    const runnerHandle = { stop: vi.fn(async () => {}) };
    const startBackgroundRunner = vi.fn(
      async (options: {
        connectionString: string;
        onMigrationsComplete?: () => void;
      }) => {
        events.push("migration");
        options.onMigrationsComplete?.();
        events.push("runner");
        return runnerHandle;
      },
    );

    const { app, runner } = await prepareApi({
      env: env(),
      startBackgroundRunner,
    });
    events.push("prepared");

    expect(runner).toBe(runnerHandle);
    expect(runner.stop).not.toHaveBeenCalled();
    expect(startBackgroundRunner).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect(events).toEqual(["migration", "runner", "prepared"]);
    expect(getRuntimeReadiness()).toMatchObject({
      state: "starting",
      database: "ready",
      runner: "ready",
      bot: "starting",
      schemaVersion: "gate1_tenants_v1",
    });

    const beforeHeartbeat = await app.request("/health/ready");
    expect(beforeHeartbeat.status).toBe(503);

    const heartbeat = await app.request("/health/bot-heartbeat", {
      method: "POST",
      headers: {
        "x-api-key": "service-key-for-a-non-local-deployment",
        "x-bot-heartbeat-secret":
          "bot-heartbeat-secret-for-a-non-local-deployment-1234567890",
        "x-request-id": "bootstrap_bot_heartbeat_1234",
      },
    });
    expect(heartbeat.status).toBe(204);
    expect(getRuntimeReadiness()).toMatchObject({
      state: "ready",
      bot: "ready",
    });
    expect((await app.request("/health/ready")).status).toBe(200);
  });

  it("keeps the migrated API ready when the runner is explicitly disabled", async () => {
    const runnerHandle = { stop: vi.fn(async () => {}) };
    const startBackgroundRunner = vi.fn(
      async (options: { onMigrationsComplete?: () => void }) => {
        expect(getRuntimeReadiness().state).toBe("starting");
        options.onMigrationsComplete?.();
        return runnerHandle;
      },
    );
    const { app, runner } = await prepareApi({
      env: { APP_RUNTIME: "local", RUNNER_ENABLED: "false" },
      startBackgroundRunner,
    });

    expect(runner).toBe(runnerHandle);
    expect(runner.stop).not.toHaveBeenCalled();
    expect(startBackgroundRunner).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    const response = await app.request("/health/ready");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: "ready",
      database: "ready",
      runner: "disabled",
    });
    markStopping();
    const stopping = await app.request("/health/ready");
    expect(stopping.status).toBe(503);
    expect(await stopping.json()).toMatchObject({ state: "stopping" });
  });

  it.each([
    "true",
    "false",
  ])("keeps migration failures fatal with RUNNER_ENABLED=%s", async (enabled) => {
    const startBackgroundRunner = vi.fn(async () => {
      throw new Error("synthetic migration failure");
    });

    await expect(
      prepareApi({
        env: { ...env(), RUNNER_ENABLED: enabled },
        startBackgroundRunner,
      }),
    ).rejects.toThrow("synthetic migration failure");
    expect(getRuntimeReadiness()).toMatchObject({ state: "failed" });
  });
});
