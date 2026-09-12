import {
  logOperationalError,
  logOperationalEvent,
  normalizeCorrelationId,
  type OperationalLogLevel,
} from "@buy-crypto-dip-bot/shared-types";
import type { H3Event } from "h3";

interface WebOperationalContext {
  operationalCorrelationId?: string;
}

export const webCorrelationId = (event: H3Event): string => {
  const context = event.context as WebOperationalContext;
  if (context.operationalCorrelationId) return context.operationalCorrelationId;

  const rawHeader = event.node.req.headers["x-request-id"];
  const correlationId = normalizeCorrelationId(
    Array.isArray(rawHeader) ? rawHeader[0] : rawHeader,
  );
  context.operationalCorrelationId = correlationId;

  try {
    if (!event.node.res.headersSent) {
      event.node.res.setHeader("x-request-id", correlationId);
    }
  } catch {
    // Error reporting must not fail when another handler already sent headers.
  }

  return correlationId;
};

export const logWebError = (
  event: H3Event,
  operation: string,
  error: unknown,
): string =>
  logOperationalError({
    service: "WEB",
    event: operation,
    correlationId: webCorrelationId(event),
    error,
  });

export const logWebEvent = (
  event: H3Event,
  operation: string,
  level: OperationalLogLevel = "INFO",
): string =>
  logOperationalEvent({
    service: "WEB",
    event: operation,
    level,
    correlationId: webCorrelationId(event),
  });
