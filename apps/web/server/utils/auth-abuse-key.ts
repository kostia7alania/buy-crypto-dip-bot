import { createHmac, randomBytes } from "node:crypto";
import type { H3Event } from "h3";
import { resolveServerApiConfig } from "./runtime-config.js";

export const TELEGRAM_LOGIN_SOURCE_HEADER = "x-telegram-login-source";

// Local development may intentionally run without API_KEY. A process-local
// secret keeps the header pseudonymous there; non-local config already requires
// API_KEY before the BFF can call the API.
const localSecret = randomBytes(32).toString("hex");

/**
 * Converts the request's network source to the only value forwarded to API.
 *
 * `x-forwarded-for` is trustworthy only when the deployment's edge proxy
 * removes caller-supplied values and writes the actual client chain. The
 * production Traefik/Cloudflare boundary must preserve that invariant; raw
 * addresses are used only in memory and never forwarded or logged here.
 */
export const telegramLoginSourcePseudonym = (
  event: H3Event,
  secret: string = resolveServerApiConfig().apiKey ?? localSecret,
): string => {
  const forwardedFor = event.node.req.headers["x-forwarded-for"];
  const forwardedSource = (
    Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  )
    ?.split(",")[0]
    ?.trim();
  const source =
    forwardedSource?.toLowerCase() ??
    event.context.clientAddress?.trim().toLowerCase() ??
    event.node.req.socket.remoteAddress?.trim().toLowerCase() ??
    "unresolved-source";
  return createHmac("sha256", secret)
    .update(`dipbot:telegram-login-source:v1\0${source}`)
    .digest("hex");
};

const readProperty = (value: unknown, property: string): unknown => {
  if ((typeof value !== "object" && typeof value !== "function") || !value) {
    return undefined;
  }
  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
};

/** Accepts only an internally consistent API 429 and its exact integer delay. */
export const telegramLoginRateLimitFrom = (
  error: unknown,
): { retryAfterSeconds: number } | null => {
  const status =
    readProperty(error, "status") ?? readProperty(error, "statusCode");
  if (status !== 429) return null;

  const data = readProperty(error, "data");
  const retryAfterSeconds = readProperty(data, "retryAfterSeconds");
  if (
    !Number.isSafeInteger(retryAfterSeconds) ||
    Number(retryAfterSeconds) <= 0
  ) {
    return null;
  }

  const response = readProperty(error, "response");
  const headers = readProperty(response, "headers");
  const getHeader = readProperty(headers, "get");
  if (typeof getHeader !== "function") return null;

  let retryAfterHeader: unknown;
  try {
    retryAfterHeader = Reflect.apply(getHeader, headers, ["retry-after"]);
  } catch {
    return null;
  }
  if (retryAfterHeader !== String(retryAfterSeconds)) return null;

  return { retryAfterSeconds: Number(retryAfterSeconds) };
};
