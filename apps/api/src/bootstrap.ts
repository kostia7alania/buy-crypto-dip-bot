import { createApp } from "./app.js";
import {
  type RunnerHandle,
  startRunner,
} from "./modules/runner/runner.service.js";
import {
  type ApiRuntimeConfig,
  resolveApiRuntimeConfig,
} from "./runtime-config.js";
import {
  beginStartup,
  markDatabaseReady,
  markRunnerDisabled,
  markRunnerReady,
  markStartupFailed,
} from "./runtime-readiness.js";

interface PrepareApiOptions {
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  startBackgroundRunner?: typeof startRunner;
}

export const prepareApi = async (
  options: PrepareApiOptions = {},
): Promise<{
  app: ReturnType<typeof createApp>;
  config: ApiRuntimeConfig;
  runner: RunnerHandle;
}> => {
  const config = resolveApiRuntimeConfig(options.env);
  beginStartup(Boolean(config.telegramBotToken));
  const startBackgroundRunner = options.startBackgroundRunner ?? startRunner;

  let runner: RunnerHandle;
  try {
    runner = await startBackgroundRunner({
      connectionString: config.postgresConnectionString,
      enabled: config.runnerEnabled,
      onMigrationsComplete: markDatabaseReady,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (config.runnerEnabled) markRunnerReady();
    else markRunnerDisabled();
  } catch (error) {
    markStartupFailed();
    throw error;
  }

  return {
    app: createApp({
      apiKey: config.apiKey,
      botHeartbeatSecret: config.botHeartbeatSecret,
      runtime: config.runtime,
      postgresConnectionString: config.postgresConnectionString,
    }),
    config,
    runner,
  };
};
