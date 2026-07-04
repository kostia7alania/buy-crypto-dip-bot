import { createBot } from './bot.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('TELEGRAM_BOT_TOKEN is empty. Bot is not started.');
  process.exit(0);
}

const bot = createBot(token);
await bot.start();
