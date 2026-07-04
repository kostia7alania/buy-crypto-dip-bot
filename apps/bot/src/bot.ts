import { Bot } from "grammy";

export const START_MESSAGE = "DCA Guard is running in DRY_RUN mode by default.";
export const STATUS_MESSAGE = "Mode: DRY_RUN\nLive trading: disabled";

export const createBot = (token: string) => {
  const bot = new Bot(token);

  bot.command("start", (ctx) => ctx.reply(START_MESSAGE));
  bot.command("status", (ctx) => ctx.reply(STATUS_MESSAGE));

  return bot;
};
