import type { H3Event } from "h3";
import type { NitroFetchOptions } from "nitropack";
import { requireAppPrincipal } from "./require-user.js";

const normalizeHeaders = (headers: HeadersInit | undefined) =>
  new Headers(headers);

// All BFF calls to the trading API go through here so the API key is
// attached in one place (server-side only — never exposed to the browser).
export const apiFetch = <T = unknown>(
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  const apiKey = process.env.API_KEY;
  const headers = normalizeHeaders(opts.headers);
  if (apiKey) headers.set("x-api-key", apiKey);

  return $fetch(`${apiUrl}${path}`, {
    ...opts,
    headers,
  }) as Promise<T>;
};

export const authenticatedApiFetch = async <T = unknown>(
  event: H3Event,
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> => {
  const principal = await requireAppPrincipal(event);
  const headers = normalizeHeaders(opts.headers);
  headers.set("x-dipbot-user-id", principal.id);
  headers.set("x-dipbot-tenant-id", principal.tenantId);

  return apiFetch<T>(path, {
    ...opts,
    headers,
  });
};
