import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import {
  classifyApiRuntime,
  resolveApiRuntimeConfig,
} from "./runtime-config.js";

const productionEnv = (): NodeJS.ProcessEnv => ({
  APP_RUNTIME: "non-local",
  API_KEY: "service-key-for-a-non-local-deployment",
  BOT_HEARTBEAT_SECRET:
    "bot-heartbeat-secret-for-a-non-local-deployment-1234567890",
  POSTGRES_CONNECTION_STRING: "postgresql://app:secret@db:5432/dipbot",
  TELEGRAM_BOT_TOKEN: "123456:test-token",
  PORT: "8787",
  EXECUTION_MODE: "DRY_RUN",
});

const previousNodeEnv = process.env.NODE_ENV;
const previousRuntime = process.env.APP_RUNTIME;
const previousApiKey = process.env.API_KEY;

afterEach(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousRuntime === undefined) delete process.env.APP_RUNTIME;
  else process.env.APP_RUNTIME = previousRuntime;
  if (previousApiKey === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = previousApiKey;
});

describe("API runtime configuration", () => {
  it("classifies production as non-local when APP_RUNTIME is omitted", () => {
    expect(classifyApiRuntime({ NODE_ENV: "production" })).toBe("non-local");
  });

  it("accepts an explicit fail-closed non-local configuration", () => {
    expect(resolveApiRuntimeConfig(productionEnv())).toMatchObject({
      runtime: "non-local",
      port: 8787,
      executionMode: "DRY_RUN",
    });
  });

  it.each([
    [undefined, false],
    ["false", false],
    ["true", true],
  ])("enables the runner only for RUNNER_ENABLED=%s", (flag, expected) => {
    const env = productionEnv();
    if (flag !== undefined) env.RUNNER_ENABLED = flag;
    expect(resolveApiRuntimeConfig(env).runnerEnabled).toBe(expected);
  });

  it("rejects an invalid runner flag instead of silently enabling execution", () => {
    expect(() =>
      resolveApiRuntimeConfig({ ...productionEnv(), RUNNER_ENABLED: "yes" }),
    ).toThrow("API_RUNTIME_CONFIG_INVALID:ENV_SHAPE");
  });

  it("rejects a missing non-local service key without echoing secrets", () => {
    const env = productionEnv();
    delete env.API_KEY;

    expect(() => resolveApiRuntimeConfig(env)).toThrow(
      "API_RUNTIME_CONFIG_INVALID:API_KEY_REQUIRED",
    );
  });

  it("rejects a missing or weak non-local bot heartbeat secret", () => {
    const missing = productionEnv();
    delete missing.BOT_HEARTBEAT_SECRET;
    expect(() => resolveApiRuntimeConfig(missing)).toThrow(
      "API_RUNTIME_CONFIG_INVALID:BOT_HEARTBEAT_SECRET_REQUIRED",
    );

    expect(() =>
      resolveApiRuntimeConfig({
        ...productionEnv(),
        BOT_HEARTBEAT_SECRET: "too-short",
      }),
    ).toThrow("API_RUNTIME_CONFIG_INVALID:BOT_HEARTBEAT_SECRET_TOO_SHORT");
  });

  it("rejects a missing non-local Telegram authority", () => {
    const env = productionEnv();
    delete env.TELEGRAM_BOT_TOKEN;

    expect(() => resolveApiRuntimeConfig(env)).toThrow(
      "API_RUNTIME_CONFIG_INVALID:TELEGRAM_BOT_TOKEN_REQUIRED",
    );
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      resolveApiRuntimeConfig({
        ...productionEnv(),
        POSTGRES_CONNECTION_STRING: "https://db.example.invalid/dipbot",
      }),
    ).toThrow("API_RUNTIME_CONFIG_INVALID:POSTGRES_CONNECTION_STRING_PROTOCOL");
  });

  it("refuses to construct a non-local app without API_KEY", () => {
    expect(() =>
      createApp({
        apiKey: "",
        botHeartbeatSecret:
          "bot-heartbeat-secret-for-a-non-local-deployment-1234567890",
        runtime: "non-local",
      }),
    ).toThrow("API_RUNTIME_CONFIG_INVALID:API_KEY_REQUIRED");
  });

  it("refuses to construct a non-local app without bot authority", () => {
    expect(() =>
      createApp({
        apiKey: "service-key-for-a-non-local-deployment",
        botHeartbeatSecret: "",
        runtime: "non-local",
      }),
    ).toThrow("API_RUNTIME_CONFIG_INVALID:BOT_HEARTBEAT_SECRET_REQUIRED");
  });
});
