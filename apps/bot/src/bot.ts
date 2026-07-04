import { Bot } from 'grammy';
export const createBot = (token: string) => { const bot = new Bot(token); bot.command('start', (ctx) => ctx.reply('DCA Guard is running in DRY_RUN mode by default.')); bot.command('status', (ctx) => ctx.reply('Mode: DRY_RUN\nLive trading: disabled')); return bot; };
