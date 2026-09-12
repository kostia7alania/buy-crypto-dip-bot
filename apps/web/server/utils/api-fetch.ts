import type { H3Event } from "h3";
import type { NitroFetchOptions } from "nitropack";
import { webCorrelationId } from "./operational-log.js";
import { resolveServerApiConfig } from "./runtime-config.js";

// All BFF calls to the trading API go through here so the API key is
// attached in one place (server-side only — never exposed to the browser).
export const apiFetch = <T = unknown>(
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> => {
  const { apiUrl, apiKey } = resolveServerApiConfig();
  return $fetch(`${apiUrl}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
  }) as Promise<T>;
};

/**
 * The same call, carrying the caller's identity.
 *
 * `apiFetch` proves the request came from this BFF; the session token proves
 * which human it is for. User-data routes need both, so they must use this
 * function rather than `apiFetch` — the API refuses them otherwise.
 */
export const apiFetchAs = <T = unknown>(
  apiSessionToken: string,
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> =>
  apiFetch<T>(path, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      "x-user-session": apiSessionToken,
    },
  });

export const apiFetchForEvent = <T = unknown>(
  event: H3Event,
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> =>
  apiFetch<T>(path, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      "x-request-id": webCorrelationId(event),
    },
  });

export const apiFetchAsForEvent = <T = unknown>(
  event: H3Event,
  apiSessionToken: string,
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> =>
  apiFetchAs<T>(apiSessionToken, path, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      "x-request-id": webCorrelationId(event),
    },
  });

interface UpstreamFailure {
  status?: number;
  data?: { error?: string };
}

const asUpstreamFailure = (error: unknown): UpstreamFailure =>
  typeof error === "object" && error !== null ? (error as UpstreamFailure) : {};

/**
 * Turns an ofetch failure into an H3 error, preserving the API's own status
 * and error code where it gave one.
 *
 * `401` is passed through unchanged so an expired session reads as "log in
 * again" rather than "the server is broken"; anything else without a status
 * becomes `502`, because a BFF that cannot reach its API is a gateway problem,
 * not the user's fault.
 */
export const upstreamError = (error: unknown, fallbackCode: string) => {
  const failure = asUpstreamFailure(error);
  return createError({
    statusCode: failure.status ?? 502,
    statusMessage: failure.data?.error ?? fallbackCode,
  });
};
