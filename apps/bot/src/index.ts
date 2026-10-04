import { verifyRuntimeDatabase } from "@buy-crypto-dip-bot/db";
import { createBot, registerBotCommands } from "./bot.js";
import { closeDb, getDb } from "./db.js";
import { startBotHeartbeat } from "./heartbeat.js";
import { logBotError, logBotEvent } from "./operational-log.js";
import { startBotRuntime } from "./runtime.js";
import { resolveBotRuntimeConfig } from "./runtime-config.js";

const config = resolveBotRuntimeConfig();
const token = config.telegramBotToken;

if (!token) {
  logBotEvent("BOT_NOT_CONFIGURED", "WARN");
  process.exit(0);
}

logBotEvent("BOT_STARTING");
const bot = createBot(token);
const runtime = startBotRuntime(bot, {
  prepare: async (signal) => {
    if (signal.aborted) return;
    if (config.runtime === "non-local") await verifyRuntimeDatabase(getDb());
    if (!signal.aborted) await registerBotCommands(bot, signal);
  },
  startHeartbeat: startBotHeartbeat,
  closeDatabase: closeDb,
});
process.on("SIGTERM", runtime.stop);
process.on("SIGINT", runtime.stop);
try {
  await runtime.polling;
} catch (error) {
  logBotError("BOT_STARTUP_FAILED", error);
  process.exitCode = 1;
} finally {
  await runtime.stop();
}
