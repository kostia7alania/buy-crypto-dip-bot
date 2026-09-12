export type ServerRuntime = "local" | "non-local";

export interface ServerApiConfig {
  runtime: ServerRuntime;
  apiUrl: string;
  apiKey: string | undefined;
}

const invalid = (code: string): never => {
  throw new Error(`WEB_RUNTIME_CONFIG_INVALID:${code}`);
};

export const resolveServerApiConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ServerApiConfig => {
  const runtime =
    env.APP_RUNTIME === "local" || env.APP_RUNTIME === "non-local"
      ? env.APP_RUNTIME
      : env.NODE_ENV === "production"
        ? "non-local"
        : "local";
  if (env.APP_RUNTIME && env.APP_RUNTIME !== runtime) {
    return invalid("APP_RUNTIME");
  }

  const apiUrl =
    env.API_URL?.trim() || (runtime === "local" ? "http://localhost:8787" : "");
  const apiKey = env.API_KEY?.trim() || undefined;
  if (!apiUrl) return invalid("API_URL_REQUIRED");
  if (runtime === "non-local" && !apiKey) return invalid("API_KEY_REQUIRED");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    return invalid("API_URL");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return invalid("API_URL_PROTOCOL");
  }

  return { runtime, apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
};
