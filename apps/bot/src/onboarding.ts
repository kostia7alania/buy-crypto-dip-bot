import { riskDefaults, strategyDefaults } from "@buy-crypto-dip-bot/config";
import { schema } from "@buy-crypto-dip-bot/db";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { getDb } from "./db.js";

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
    s !== undefined && (WIZARD_COINS as readonly string[]).includes(s);
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
    .text("✅ Start dry-run", `wiz:apply:${symbol}:${threshold}:${amount}`)
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
            `Buy when the price drops this far below the recent high. ` +
            `Smaller = more frequent buys, larger = only real dips.`,
          {
            parse_mode: "Markdown",
            reply_markup: buildThresholdKeyboard(parsed.symbol),
          },
        );

      case "amount":
        return ctx.editMessageText(
          `🧭 *Step 3 of 3 — buy amount*\n\n` +
            `How much USDT should each simulated ${coinLabel(parsed.symbol)} ` +
            `dip buy spend?`,
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
            `• *Dip threshold:* \`-${parsed.thresholdPercent}%\`\n` +
            `• *Buy amount:* \`${parsed.amountUsdt} USDT\`\n` +
            `• *Daily limit:* \`${strategyDefaults.maxDailySpendUsdt} USDT\`\n` +
            `• *Mode:* \`DRY_RUN\` (simulated, no real money)\n\n` +
            `Start watching for dips?`,
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
        try {
          const db = getDb();
          const [existing] = await db
            .select()
            .from(schema.strategies)
            .where(eq(schema.strategies.symbol, parsed.symbol))
            .limit(1);

          const configPatch = {
            thresholdPercent: parsed.thresholdPercent,
            suggestedQuoteAmount: parsed.amountUsdt,
          };

          let strategyId: string;
          if (existing) {
            await db
              .update(schema.strategies)
              .set({
                enabled: true,
                config: { ...(existing.config as object), ...configPatch },
              })
              .where(eq(schema.strategies.id, existing.id));
            strategyId = existing.id;
          } else {
            // Wizard coins come from the risk allowlist, so no exchange
            // validation round-trip is needed here (unlike /add_pair).
            const [created] = await db
              .insert(schema.strategies)
              .values({
                name: `${parsed.symbol} Dip Buying Strategy`,
                symbol: parsed.symbol,
                mode: "DRY_RUN",
                config: { ...strategyDefaults, ...configPatch },
              })
              .returning();
            if (!created) throw new Error("insert returned no row");
            strategyId = created.id;
          }

          await db.insert(schema.auditEvents).values({
            entityType: "strategy",
            entityId: strategyId,
            action: "STRATEGY_ONBOARDED",
            payload: {
              symbol: parsed.symbol,
              ...configPatch,
              via: "telegram_wizard",
            },
          });

          return ctx.editMessageText(
            `🎉 *You're set — watching ${parsed.symbol} for dips*\n\n` +
              `• Buys \`${parsed.amountUsdt} USDT\` on every \`-${parsed.thresholdPercent}%\` dip\n` +
              `• \`DRY_RUN\` mode: every buy is simulated and cancellable\n\n` +
              `*Useful next:*\n` +
              `• /status — what the bot is doing right now\n` +
              `• /pnl — simulated portfolio result\n` +
              `• /backtest — replay this strategy over real history\n` +
              `• /pause\\_all — kill switch, stops everything`,
            { parse_mode: "Markdown" },
          );
        } catch (error) {
          console.error("Onboarding wizard failed to save strategy:", error);
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
