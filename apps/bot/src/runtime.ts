import type { Bot } from "grammy";
import { logBotError, logBotEvent } from "./operational-log.js";

export const BOT_SHUTDOWN_TIMEOUT_MS = 25_000;

interface BotRuntimeOptions {
  prepare?: (signal: AbortSignal) => Promise<void>;
  startHeartbeat: () => () => Promise<void>;
  closeDatabase: () => Promise<void>;
  exit?: (code: number) => void;
}

export const startBotRuntime = (bot: Bot, options: BotRuntimeOptions) => {
  const startup = new AbortController();
  const settled = Promise.withResolvers<void>();
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let stopHeartbeat = async () => {};
  let completion: Promise<void> | undefined;
  let timedOut = false;
  let pollingFailed = false;

  bot.api.config.use(async (previous, method, payload, signal) => {
    if (completion && method === "getUpdates" && !signal) {
      // grammY stop() acknowledges an update before its handler has finished.
      // Defer that request, not the polling abort, until the accepted batch drains.
      await settled.promise;
      if (timedOut) throw new Error("BOT_SHUTDOWN_TIMED_OUT");
      if (pollingFailed) throw new Error("BOT_POLLING_FAILED");
    }
    return previous(method, payload, signal);
  });

  const polling = (async () => {
    let initialized = false;
    try {
      // grammY still types this standard signal through its legacy polyfill.
      await bot.init(
        startup.signal as unknown as Parameters<typeof bot.init>[0],
      );
      initialized = true;
      if (completion) return;
      await options.prepare?.(startup.signal);
      if (completion) return;
      await bot.start({
        onStart: () => {
          if (completion) return;
          stopHeartbeat = options.startHeartbeat();
          logBotEvent("BOT_POLLING_STARTED");
        },
      });
    } catch (error) {
      if (initialized || !startup.signal.aborted) {
        pollingFailed = true;
        throw error;
      }
    } finally {
      settled.resolve();
    }
  })();

  const stop = (): Promise<void> => {
    if (completion) return completion;
    const { promise, resolve } = Promise.withResolvers<void>();
    completion = promise;
    logBotEvent("BOT_SHUTDOWN_STARTED");
    startup.abort();
    let finished = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      finished = true;
      logBotEvent("BOT_SHUTDOWN_TIMED_OUT", "ERROR");
      resolve();
      exit(1);
    }, BOT_SHUTDOWN_TIMEOUT_MS);

    const drain = async () => {
      const results = await Promise.allSettled([
        bot.stop(),
        polling,
        stopHeartbeat(),
      ]);
      if (finished) return;
      await options.closeDatabase();
      if (finished) return;
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
      }
      finished = true;
      clearTimeout(deadline);
      logBotEvent("BOT_SHUTDOWN_COMPLETED");
      resolve();
      exit(0);
    };
    void drain().catch((error: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      logBotError("BOT_SHUTDOWN_FAILED", error);
      resolve();
      exit(1);
    });
    return completion;
  };

  return { polling, stop };
};
