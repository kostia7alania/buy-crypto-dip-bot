import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBotHeartbeatApi,
  resolveBotRuntimeConfig,
} from "./runtime-config.js";

const nonLocalEnv = (): NodeJS.ProcessEnv => ({
  APP_RUNTIME: "non-local",
  TELEGRAM_BOT_TOKEN: "123456:test-token",
  API_URL: "http://api:8787",
  API_KEY: "service-key",
  BOT_HEARTBEAT_SECRET:
    "bot-heartbeat-secret-for-a-non-local-deployment-1234567890",
  POSTGRES_CONNECTION_STRING: "postgresql://app:secret@db:5432/dipbot",
});

describe("bot runtime configuration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a complete non-local server-only configuration", () => {
    expect(resolveBotRuntimeConfig(nonLocalEnv())).toMatchObject({
      runtime: "non-local",
      apiUrl: "http://api:8787",
    });
  });

  it.each([
    ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN_REQUIRED"],
    ["API_URL", "API_URL_REQUIRED"],
    ["API_KEY", "API_KEY_REQUIRED"],
    ["BOT_HEARTBEAT_SECRET", "BOT_HEARTBEAT_SECRET_REQUIRED"],
    ["POSTGRES_CONNECTION_STRING", "POSTGRES_CONNECTION_STRING_REQUIRED"],
  ])("refuses non-local startup without %s", (key, code) => {
    const env = nonLocalEnv();
    delete env[key];
    expect(() => resolveBotRuntimeConfig(env)).toThrow(
      `BOT_RUNTIME_CONFIG_INVALID:${code}`,
    );
  });

  it("rejects a weak heartbeat credential", () => {
    expect(() =>
      resolveBotRuntimeConfig({
        ...nonLocalEnv(),
        BOT_HEARTBEAT_SECRET: "too-short",
      }),
    ).toThrow("BOT_RUNTIME_CONFIG_INVALID:BOT_HEARTBEAT_SECRET_TOO_SHORT");
  });

  it("sends API and bot-only credentials on the dedicated heartbeat call", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchBotHeartbeatApi(
      { method: "POST", headers: { "x-request-id": "heartbeat_test_1234" } },
      nonLocalEnv(),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = new Headers(init.headers);
    expect(url).toBe("http://api:8787/health/bot-heartbeat");
    expect(headers.get("x-api-key")).toBe("service-key");
    expect(headers.get("x-bot-heartbeat-secret")).toBe(
      "bot-heartbeat-secret-for-a-non-local-deployment-1234567890",
    );
    expect(headers.get("x-request-id")).toBe("heartbeat_test_1234");
  });
});
