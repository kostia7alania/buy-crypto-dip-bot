import { Bot } from 'grammy';

export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command('start', (ctx) =>
    ctx.reply('DCA Guard is running in DRY_RUN mode. No live trading is enabled.'),
  );

  bot.command('status', (ctx) =>
    ctx.reply('Mode: DRY_RUN
Live trading: disabled
Allowed symbols: BTCUSDT'),
  );

  return bot;
}
