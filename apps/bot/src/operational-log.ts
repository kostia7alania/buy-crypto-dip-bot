import {
  logOperationalError,
  logOperationalEvent,
  normalizeCorrelationId,
  type OperationalLogLevel,
} from "@buy-crypto-dip-bot/shared-types";

export const botCorrelationId = (updateId: number | undefined): string =>
  normalizeCorrelationId(
    updateId === undefined ? undefined : `telegram_update_${updateId}`,
  );

export const logBotError = (
  event: string,
  error: unknown,
  updateId?: number,
): string =>
  logOperationalError({
    service: "BOT",
    event,
    correlationId: botCorrelationId(updateId),
    error,
  });

export const logBotEvent = (
  event: string,
  level: OperationalLogLevel = "INFO",
  updateId?: number,
): string =>
  logOperationalEvent({
    service: "BOT",
    event,
    level,
    correlationId: botCorrelationId(updateId),
  });
