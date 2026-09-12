const LOCAL_API_URL = "http://localhost:8787";
const LOCAL_POSTGRES_URL =
  "postgresql://postgres:local_password@localhost:5432/dipbot";

export type BotRuntime = "local" | "non-local";

export interface BotRuntimeConfig {
  runtime: BotRuntime;
  telegramBotToken: string | undefined;
  apiUrl: string;
  apiKey: string | undefined;
  botHeartbeatSecret: string | undefined;
  postgresConnectionString: string;
}

const invalid = (code: string): never => {
  throw new Error(`BOT_RUNTIME_CONFIG_INVALID:${code}`);
};

export const resolveBotRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): BotRuntimeConfig => {
  const runtime =
    env.APP_RUNTIME === "local" || env.APP_RUNTIME === "non-local"
      ? env.APP_RUNTIME
      : env.NODE_ENV === "production"
        ? "non-local"
        : "local";
  if (env.APP_RUNTIME && env.APP_RUNTIME !== runtime) {
    return invalid("APP_RUNTIME");
  }

  const telegramBotToken = env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
  const apiUrl =
    env.API_URL?.trim() || (runtime === "local" ? LOCAL_API_URL : "");
  const apiKey = env.API_KEY?.trim() || undefined;
  const botHeartbeatSecret = env.BOT_HEARTBEAT_SECRET?.trim() || undefined;
  const postgresConnectionString =
    env.POSTGRES_CONNECTION_STRING?.trim() ||
    (runtime === "local" ? LOCAL_POSTGRES_URL : "");

  if (runtime === "non-local" && !telegramBotToken) {
    return invalid("TELEGRAM_BOT_TOKEN_REQUIRED");
  }
  if (!apiUrl) return invalid("API_URL_REQUIRED");
  if (runtime === "non-local" && !apiKey) return invalid("API_KEY_REQUIRED");
  if (runtime === "non-local" && !botHeartbeatSecret) {
    return invalid("BOT_HEARTBEAT_SECRET_REQUIRED");
  }
  if (botHeartbeatSecret && botHeartbeatSecret.length < 32) {
    return invalid("BOT_HEARTBEAT_SECRET_TOO_SHORT");
  }
  if (!postgresConnectionString) {
    return invalid("POSTGRES_CONNECTION_STRING_REQUIRED");
  }

  let parsedApiUrl: URL;
  let parsedPostgresUrl: URL;
  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    return invalid("API_URL");
  }
  try {
    parsedPostgresUrl = new URL(postgresConnectionString);
  } catch {
    return invalid("POSTGRES_CONNECTION_STRING_URL");
  }
  if (parsedApiUrl.protocol !== "http:" && parsedApiUrl.protocol !== "https:") {
    return invalid("API_URL_PROTOCOL");
  }
  if (
    parsedPostgresUrl.protocol !== "postgres:" &&
    parsedPostgresUrl.protocol !== "postgresql:"
  ) {
    return invalid("POSTGRES_CONNECTION_STRING_PROTOCOL");
  }

  return {
    runtime,
    telegramBotToken,
    apiUrl: apiUrl.replace(/\/$/, ""),
    apiKey,
    botHeartbeatSecret,
    postgresConnectionString,
  };
};

export const fetchServiceApi = (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const config = resolveBotRuntimeConfig();
  const headers = new Headers(init.headers);
  if (config.apiKey) headers.set("x-api-key", config.apiKey);
  return fetch(`${config.apiUrl}${path}`, { ...init, headers });
};

export const fetchBotHeartbeatApi = (
  init: RequestInit = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> => {
  const config = resolveBotRuntimeConfig(env);
  const headers = new Headers(init.headers);
  if (config.apiKey) headers.set("x-api-key", config.apiKey);
  if (config.botHeartbeatSecret) {
    headers.set("x-bot-heartbeat-secret", config.botHeartbeatSecret);
  }
  return fetch(`${config.apiUrl}/health/bot-heartbeat`, { ...init, headers });
};
