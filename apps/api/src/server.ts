import { serve } from "@hono/node-server";
import { prepareApi } from "./bootstrap.js";
import { logApiError, logApiEvent } from "./operational-log.js";

try {
  const { app, config } = await prepareApi();
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    void info;
    logApiEvent("API_LISTENING");
  });
} catch (error) {
  logApiError("API_STARTUP_FAILED", error);
  process.exitCode = 1;
}
