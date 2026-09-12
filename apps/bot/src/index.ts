import { createBot } from "./bot.js";
import { startBotHeartbeat } from "./heartbeat.js";
import { logBotError, logBotEvent } from "./operational-log.js";
import { resolveBotRuntimeConfig } from "./runtime-config.js";

const config = resolveBotRuntimeConfig();
const token = config.telegramBotToken;

if (!token) {
  logBotEvent("BOT_NOT_CONFIGURED", "WARN");
  process.exit(0);
}

logBotEvent("BOT_STARTING");
const stopHeartbeat = startBotHeartbeat();
try {
  await createBot(token).start();
} catch (error) {
  logBotError("BOT_STARTUP_FAILED", error);
  process.exitCode = 1;
} finally {
  stopHeartbeat();
}
