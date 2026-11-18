import {
  isAllowedSymbol,
  riskDefaults,
  strategyDefaults,
} from "@buy-crypto-dip-bot/config";
import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { requireCallbackCaller } from "./caller.js";
import { applyOwnedOnboardingStrategy } from "./command.repository.js";
import { getDb } from "./db.js";
import { botCorrelationId, logBotError } from "./operational-log.js";

// The onboarding wizard is stateless: every step encodes its accumulated
// choices in the callback data (`wiz:<step>:...args`), so no session storage
// is needed and the flow survives bot restarts mid-conversation.

export const WIZARD_COINS = riskDefaults.allowlistSymbols;
export const WIZARD_THRESHOLDS = [1, 2, 3, 5] as const;
export const WIZARD_AMOUNTS = [10, 20, 50, 100] as const;

export type WizardStep =
  | { step: "coin" }
  | { step: "threshold"; symbol: string }
  | { step: "amount"; symbol: string; thresholdPercent: number }
  | {
      step: "confirm";
      symbol: string;
      thresholdPercent: number;
      amountUsdt: number;
    }
  | {
      step: "apply";
      symbol: string;
      thresholdPercent: number;
      amountUsdt: number;
    }
  | { step: "cancel" };

// Parse and validate `wiz:` callback data. Every value must come from the
// fixed option lists — forged callback data must never reach the database.
export const parseWizardCallback = (data: string): WizardStep | null => {
  const parts = data.split(":");
  if (parts[0] !== "wiz") return null;

  const isCoin = (s: string | undefined): s is string =>
    s !== undefined && isAllowedSymbol(s, process.env.ALLOWLIST_SYMBOLS);
  const isThreshold = (n: number) =>
    (WIZARD_THRESHOLDS as readonly number[]).includes(n);
  const isAmount = (n: number) =>
    (WIZARD_AMOUNTS as readonly number[]).includes(n);

  switch (parts[1]) {
    case "coin":
      return { step: "coin" };
    case "cancel":
      return { step: "cancel" };
    case "threshold": {
      if (!isCoin(parts[2])) return null;
      return { step: "threshold", symbol: parts[2] };
    }
    case "amount": {
      const threshold = Number(parts[3]);
      if (!isCoin(parts[2]) || !isThreshold(threshold)) return null;
      return { step: "amount", symbol: parts[2], thresholdPercent: threshold };
    }
    case "confirm":
    case "apply": {
      const threshold = Number(parts[3]);
      const amount = Number(parts[4]);
      if (!isCoin(parts[2]) || !isThreshold(threshold) || !isAmount(amount)) {
        return null;
      }
      return {
        step: parts[1],
        symbol: parts[2],
        thresholdPercent: threshold,
        amountUsdt: amount,
      };
    }
    default:
      return null;
  }
};

const coinLabel = (symbol: string) => symbol.replace(/USDT$/, "");

export const buildCoinKeyboard = () => {
  const kb = new InlineKeyboard();
  for (const symbol of WIZARD_COINS) {
    if (!isAllowedSymbol(symbol, process.env.ALLOWLIST_SYMBOLS)) continue;
    kb.text(coinLabel(symbol), `wiz:threshold:${symbol}`);
  }
  return kb.row().text("✖️ Cancel", "wiz:cancel");
};

export const buildThresholdKeyboard = (symbol: string) => {
  const kb = new InlineKeyboard();
  for (const t of WIZARD_THRESHOLDS) {
    kb.text(`-${t}%`, `wiz:amount:${symbol}:${t}`);
  }
  return kb.row().text("✖️ Cancel", "wiz:cancel");
};

export const buildAmountKeyboard = (symbol: string, threshold: number) => {
  const kb = new InlineKeyboard();
  for (const a of WIZARD_AMOUNTS) {
    kb.text(`${a} USDT`, `wiz:confirm:${symbol}:${threshold}:${a}`);
  }
  return kb.row().text("✖️ Cancel", "wiz:cancel");
};

export const buildConfirmKeyboard = (
  symbol: string,
  threshold: number,
  amount: number,
) =>
  new InlineKeyboard()
    .text("✅ Save strategy", `wiz:apply:${symbol}:${threshold}:${amount}`)
    .row()
    .text("↩️ Start over", "wiz:coin")
    .text("✖️ Cancel", "wiz:cancel");

export const startKeyboard = () =>
  new InlineKeyboard().text("🚀 Set up my first dip buy", "wiz:coin");

export const registerOnboardingWizard = (bot: Bot) => {
  bot.callbackQuery(/^wiz:/, async (ctx) => {
    const parsed = parseWizardCallback(ctx.callbackQuery.data);
    if (!parsed) {
      return ctx.answerCallbackQuery("❌ Unknown wizard action.");
    }

    await ctx.answerCallbackQuery().catch(() => {});

    switch (parsed.step) {
      case "coin":
        return ctx.editMessageText(
          `🧭 *Step 1 of 3 — pick a coin*\n\n` +
            `Which coin should I watch for dips? Everything runs in ` +
            `\`DRY_RUN\` mode — simulated buys only, no real money.`,
          { parse_mode: "Markdown", reply_markup: buildCoinKeyboard() },
        );

      case "threshold":
        return ctx.editMessageText(
          `🧭 *Step 2 of 3 — dip threshold for ${coinLabel(parsed.symbol)}*\n\n` +
            `A dip reaches this threshold when the price is this far below its 24h high. ` +
            `Budget limits and cooldown still apply.`,
          {
            parse_mode: "Markdown",
            reply_markup: buildThresholdKeyboard(parsed.symbol),
          },
        );

      case "amount":
        return ctx.editMessageText(
          `🧭 *Step 3 of 3 — buy amount*\n\n` +
            `Choose the amount in USDT for each approved simulated ${coinLabel(parsed.symbol)} buy.`,
          {
            parse_mode: "Markdown",
            reply_markup: buildAmountKeyboard(
              parsed.symbol,
              parsed.thresholdPercent,
            ),
          },
        );

      case "confirm":
        return ctx.editMessageText(
          `🔎 *Review your dip strategy*\n\n` +
            `• *Coin:* \`${parsed.symbol}\`\n` +
            `• *Dip threshold:* \`${parsed.thresholdPercent}%\` below the 24h high\n` +
            `• *Buy amount:* \`${parsed.amountUsdt} USDT\`\n` +
            `• *Mode:* \`DRY_RUN\` (simulated, no real money)\n\n` +
            `*A new strategy starts paused with these defaults*\n` +
            `• Rolling 24h limit — ${strategyDefaults.maxDailySpendUsdt} USDT\n` +
            `• Rolling 7d limit — ${strategyDefaults.maxWeeklySpendUsdt} USDT\n` +
            `• Cooldown — ${strategyDefaults.cooldownMinutes} minutes\n\n` +
            `Saving an existing strategy keeps its limits and cooldown and enables it.`,
          {
            parse_mode: "Markdown",
            reply_markup: buildConfirmKeyboard(
              parsed.symbol,
              parsed.thresholdPercent,
              parsed.amountUsdt,
            ),
          },
        );

      case "apply": {
        // Only the "apply" step writes anything, so this is the one step that
        // needs an identified owner. Earlier steps just redraw a keyboard.
        const caller = await requireCallbackCaller(ctx);
        if (!caller) return;

        try {
          const db = getDb();
          const correlationId = botCorrelationId(ctx.update.update_id);

          // Wizard coins come from the risk allowlist, so no exchange
          // validation round-trip is needed here (unlike /add_pair).
          const result = await applyOwnedOnboardingStrategy(
            db,
            caller.id,
            {
              symbol: parsed.symbol,
              thresholdPercent: parsed.thresholdPercent,
              amountUsdt: parsed.amountUsdt,
            },
            correlationId,
          );

          const saved =
            result.outcome === "CREATED"
              ? `*${parsed.symbol} strategy saved and paused*\nEnable it with \`/toggle ${parsed.symbol}\`.`
              : `*${parsed.symbol} strategy updated and enabled*`;

          return ctx.editMessageText(
            `✅ ${saved}\n\n` +
              `The strategy considers simulated buys of \`${parsed.amountUsdt} USDT\` when the price is at least ` +
              `\`${parsed.thresholdPercent}%\` below its 24h high. Budget limits and cooldown apply.\n\n` +
              `*Useful next:*\n` +
              `• /status — see your simulated activity\n` +
              `• /decision — see your last recorded risk decision\n` +
              `• /budget — see your remaining simulated budget\n` +
              `• /pnl — simulated portfolio result\n` +
              `• /backtest — replay this strategy over real history\n` +
              `• /pause\\_all — pause your strategies`,
            { parse_mode: "Markdown" },
          );
        } catch (error) {
          logBotError(
            "ONBOARDING_STRATEGY_SAVE_FAILED",
            error,
            ctx.update.update_id,
          );
          return ctx.editMessageText(
            "❌ Could not save the strategy. Is the database running? Try /start again.",
          );
        }
      }

      case "cancel":
        return ctx.editMessageText(
          `✖️ Setup cancelled — nothing was changed.\n` +
            `Run /start whenever you want to try again.`,
        );
    }
  });
};
