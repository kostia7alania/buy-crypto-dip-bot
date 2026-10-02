import { createApp } from "./app.js";
import { startRunner } from "./modules/runner/runner.service.js";
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
  startBackgroundRunner?: typeof startRunner;
}

export const prepareApi = async (
  options: PrepareApiOptions = {},
): Promise<{ app: ReturnType<typeof createApp>; config: ApiRuntimeConfig }> => {
  const config = resolveApiRuntimeConfig(options.env);
  beginStartup(Boolean(config.telegramBotToken));
  const startBackgroundRunner = options.startBackgroundRunner ?? startRunner;

  try {
    await startBackgroundRunner({
      connectionString: config.postgresConnectionString,
      enabled: config.runnerEnabled,
      onMigrationsComplete: markDatabaseReady,
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
    }),
    config,
  };
};
