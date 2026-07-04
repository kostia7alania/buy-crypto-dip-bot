import { createBot } from "./bot.js";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log("TELEGRAM_BOT_TOKEN is not set. Bot is not started.");
  process.exit(0);
}

console.log("🤖 DCA Guard Telegram Bot successfully started and listening...");
await createBot(token).start();
