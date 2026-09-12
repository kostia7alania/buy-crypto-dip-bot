import {
  logOperationalError,
  logOperationalEvent,
  type OperationalLogLevel,
} from "@buy-crypto-dip-bot/shared-types";

export const logApiError = (
  event: string,
  error: unknown,
  correlationId?: string,
): string =>
  logOperationalError({
    service: "API",
    event,
    correlationId,
    error,
  });

export const logApiEvent = (
  event: string,
  level: OperationalLogLevel = "INFO",
  correlationId?: string,
): string =>
  logOperationalEvent({
    service: "API",
    event,
    level,
    correlationId,
  });
