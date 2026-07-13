import { orderExecutionDelaySeconds } from "@buy-crypto-dip-bot/config";

const COUNTDOWN_BAR_WIDTH = 10;

export const getCountdownSecondsLeft = (
  executeAt: Date,
  nowMs = Date.now(),
): number => Math.max(0, Math.ceil((executeAt.getTime() - nowMs) / 1000));

export const buildPendingText = (
  strategyName: string,
  symbol: string,
  price: number,
  quoteAmount: number,
  secondsLeft: number,
): string => {
  const boundedSecondsLeft = Math.min(
    orderExecutionDelaySeconds,
    Math.max(0, secondsLeft),
  );
  const filled = Math.min(
    COUNTDOWN_BAR_WIDTH,
    Math.round(
      ((orderExecutionDelaySeconds - boundedSecondsLeft) /
        orderExecutionDelaySeconds) *
        COUNTDOWN_BAR_WIDTH,
    ),
  );
  const bar = "▓".repeat(filled) + "░".repeat(COUNTDOWN_BAR_WIDTH - filled);

  return (
    `🚨 *Pending Buy Alert*\n\n` +
    `• *Strategy:* ${strategyName}\n` +
    `• *Symbol:* ${symbol}\n` +
    `• *Price:* $${price.toLocaleString("en-US")}\n` +
    `• *Amount:* ${quoteAmount} USDT\n` +
    `• *Status:* ⏳ Executing in *${boundedSecondsLeft}s*\n` +
    `\`${bar}\``
  );
};
