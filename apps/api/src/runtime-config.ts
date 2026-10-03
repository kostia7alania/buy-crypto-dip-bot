import * as v from "valibot";

export const LOCAL_POSTGRES_URL =
  "postgresql://postgres:local_password@localhost:5432/dipbot";

const runtimeEnvSchema = v.object({
  APP_RUNTIME: v.optional(v.picklist(["local", "non-local"])),
  NODE_ENV: v.optional(v.string()),
  API_KEY: v.optional(v.string()),
  BOT_HEARTBEAT_SECRET: v.optional(v.string()),
  POSTGRES_CONNECTION_STRING: v.optional(v.string()),
  TELEGRAM_BOT_TOKEN: v.optional(v.string()),
  PORT: v.optional(v.string()),
  EXECUTION_MODE: v.optional(v.picklist(["DRY_RUN"])),
  RUNNER_ENABLED: v.optional(v.picklist(["true", "false"])),
});

export type ApiRuntime = "local" | "non-local";

export interface ApiRuntimeConfig {
  runtime: ApiRuntime;
  apiKey: string | undefined;
  botHeartbeatSecret: string | undefined;
  postgresConnectionString: string;
  telegramBotToken: string | undefined;
  port: number;
  executionMode: "DRY_RUN";
  runnerEnabled: boolean;
}

const invalid = (code: string): never => {
  throw new Error(`API_RUNTIME_CONFIG_INVALID:${code}`);
};

export const classifyApiRuntime = (
  env: NodeJS.ProcessEnv = process.env,
): ApiRuntime => {
  if (env.APP_RUNTIME === "local" || env.APP_RUNTIME === "non-local") {
    return env.APP_RUNTIME;
  }
  if (env.APP_RUNTIME) return invalid("APP_RUNTIME");
  return env.NODE_ENV === "production" ? "non-local" : "local";
};

export const resolveApiRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig => {
  const parsed = v.safeParse(runtimeEnvSchema, env);
  if (!parsed.success) return invalid("ENV_SHAPE");

  const runtime = classifyApiRuntime(env);
  const apiKey = parsed.output.API_KEY?.trim() || undefined;
  const botHeartbeatSecret =
    parsed.output.BOT_HEARTBEAT_SECRET?.trim() || undefined;
  const postgresConnectionString =
    parsed.output.POSTGRES_CONNECTION_STRING?.trim() ||
    (runtime === "local" ? LOCAL_POSTGRES_URL : undefined);
  const telegramBotToken =
    parsed.output.TELEGRAM_BOT_TOKEN?.trim() || undefined;

  if (runtime === "non-local" && !apiKey) return invalid("API_KEY_REQUIRED");
  if (runtime === "non-local" && !botHeartbeatSecret) {
    return invalid("BOT_HEARTBEAT_SECRET_REQUIRED");
  }
  if (botHeartbeatSecret && botHeartbeatSecret.length < 32) {
    return invalid("BOT_HEARTBEAT_SECRET_TOO_SHORT");
  }
  if (runtime === "non-local" && !telegramBotToken) {
    return invalid("TELEGRAM_BOT_TOKEN_REQUIRED");
  }
  if (!postgresConnectionString) {
    return invalid("POSTGRES_CONNECTION_STRING_REQUIRED");
  }

  let postgresUrl: URL;
  try {
    postgresUrl = new URL(postgresConnectionString);
  } catch {
    return invalid("POSTGRES_CONNECTION_STRING_URL");
  }
  if (
    postgresUrl.protocol !== "postgres:" &&
    postgresUrl.protocol !== "postgresql:"
  ) {
    return invalid("POSTGRES_CONNECTION_STRING_PROTOCOL");
  }

  const port = Number(parsed.output.PORT ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return invalid("PORT");
  }

  return {
    runtime,
    apiKey,
    botHeartbeatSecret,
    postgresConnectionString,
    telegramBotToken,
    port,
    executionMode: parsed.output.EXECUTION_MODE ?? "DRY_RUN",
    runnerEnabled: parsed.output.RUNNER_ENABLED === "true",
  };
};
