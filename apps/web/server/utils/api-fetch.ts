import type { NitroFetchOptions } from "nitropack";

// All BFF calls to the trading API go through here so the API key is
// attached in one place (server-side only — never exposed to the browser).
export const apiFetch = <T = unknown>(
  path: string,
  opts: NitroFetchOptions<string> = {},
): Promise<T> => {
  const apiUrl = process.env.API_URL ?? "http://localhost:8787";
  const apiKey = process.env.API_KEY;
  return $fetch(`${apiUrl}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
  }) as Promise<T>;
};
