import { Bot } from "grammy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOT_SHUTDOWN_TIMEOUT_MS, startBotRuntime } from "./runtime.js";

const identity = {
  id: 1,
  is_bot: true as const,
  first_name: "Local fixture",
  username: "local_fixture_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

const setup = (failHandler = false) => {
  const bot = new Bot("1:local_fixture_only", { botInfo: identity });
  const entered = Promise.withResolvers<void>();
  const handler = Promise.withResolvers<void>();
  const events: string[] = [];
  const calls: string[] = [];
  bot.api.config.use(async (_previous, method) => {
    calls.push(method);
    if (method === "deleteWebhook") {
      return { ok: true, result: true } as Awaited<
        ReturnType<typeof _previous>
      >;
    }
    if (method !== "getUpdates") throw new Error("UNEXPECTED_TELEGRAM_CALL");
    const first = calls.filter((call) => call === "getUpdates").length === 1;
    if (!first) events.push("acknowledged");
    return {
      ok: true,
      result: first
        ? [
            { update_id: 101, message: { message_id: 1 } },
            { update_id: 102, message: { message_id: 2 } },
          ]
        : [],
    } as Awaited<ReturnType<typeof _previous>>;
  });
  bot.use(async (ctx) => {
    events.push(`started:${ctx.update.update_id}`);
    entered.resolve();
    await handler.promise;
    if (failHandler) throw new Error("HANDLER_FAILED");
    events.push(`finished:${ctx.update.update_id}`);
  });
  bot.catch((error) => {
    throw error;
  });
  const stopHeartbeat = vi.fn(async () => {
    events.push("heartbeat-stopped");
  });
  const closeDatabase = vi.fn(async () => {
    events.push("database-closed");
  });
  const exit = vi.fn();
  const runtime = startBotRuntime(bot, {
    startHeartbeat: () => stopHeartbeat,
    closeDatabase,
    exit,
  });
  return { bot, entered, handler, events, calls, closeDatabase, exit, runtime };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("polling bot shutdown", () => {
  it("defers grammY's stop acknowledgement until the accepted batch finishes, then closes the pool", async () => {
    const state = setup();
    await state.entered.promise;
    const stopped = state.runtime.stop();
    expect(state.runtime.stop()).toBe(stopped);
    expect(state.bot.isRunning()).toBe(false);
    expect(state.events).toEqual(["started:101", "heartbeat-stopped"]);
    expect(state.closeDatabase).not.toHaveBeenCalled();
    expect(state.calls.filter((call) => call === "getUpdates")).toHaveLength(1);

    state.handler.resolve();
    await stopped;
    expect(state.events).toEqual([
      "started:101",
      "heartbeat-stopped",
      "finished:101",
      "started:102",
      "finished:102",
      "acknowledged",
      "database-closed",
    ]);
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out without acknowledging unfinished work or closing its pool", async () => {
    const state = setup();
    await state.entered.promise;
    const stopped = state.runtime.stop();
    await vi.advanceTimersByTimeAsync(BOT_SHUTDOWN_TIMEOUT_MS);
    await stopped;
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(state.closeDatabase).not.toHaveBeenCalled();
    expect(state.events).not.toContain("acknowledged");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"event":"BOT_SHUTDOWN_TIMED_OUT"'),
    );

    state.handler.resolve();
    await state.runtime.polling;
    await vi.advanceTimersByTimeAsync(0);
    expect(state.events).not.toContain("acknowledged");
    expect(state.closeDatabase).not.toHaveBeenCalled();
    expect(state.exit).toHaveBeenCalledTimes(1);
  });

  it("does not acknowledge a batch when polling fails during drain", async () => {
    const state = setup(true);
    const failure = expect(state.runtime.polling).rejects.toThrow(
      "HANDLER_FAILED",
    );
    await state.entered.promise;
    const stopped = state.runtime.stop();
    state.handler.resolve();
    await failure;
    await stopped;
    expect(state.events).not.toContain("acknowledged");
    expect(state.closeDatabase).toHaveBeenCalledOnce();
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("does not start heartbeat when shutdown interrupts polling setup", async () => {
    const bot = new Bot("1:local_fixture_only", { botInfo: identity });
    const entered = Promise.withResolvers<void>();
    const setupGate = Promise.withResolvers<void>();
    bot.api.config.use(async (_previous, method) => {
      if (method === "deleteWebhook") {
        entered.resolve();
        await setupGate.promise;
      }
      return {
        ok: true,
        result: method === "getUpdates" ? [] : true,
      } as Awaited<ReturnType<typeof _previous>>;
    });
    const startHeartbeat = vi.fn(() => async () => {});
    const exit = vi.fn();
    const runtime = startBotRuntime(bot, {
      startHeartbeat,
      closeDatabase: async () => {},
      exit,
    });
    await entered.promise;
    const stopped = runtime.stop();
    setupGate.resolve();
    await stopped;
    expect(startHeartbeat).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("cancels initialization without starting polling or readiness heartbeat", async () => {
    const bot = new Bot("1:local_fixture_only");
    const entered = Promise.withResolvers<void>();
    const calls: string[] = [];
    bot.api.config.use(async (_previous, method, _payload, signal) => {
      calls.push(method);
      entered.resolve();
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("ABORTED")), {
          once: true,
        });
      });
      throw new Error("UNEXPECTED_INITIALIZATION_COMPLETION");
    });
    const startHeartbeat = vi.fn(() => async () => {});
    const closeDatabase = vi.fn(async () => {});
    const exit = vi.fn();
    const runtime = startBotRuntime(bot, {
      startHeartbeat,
      closeDatabase,
      exit,
    });
    await entered.promise;
    await runtime.stop();
    expect(calls).toEqual(["getMe"]);
    expect(startHeartbeat).not.toHaveBeenCalled();
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });
});
