import { serve } from "@hono/node-server";
import { prepareApi } from "./bootstrap.js";
import { closeDb } from "./db.js";
import { logApiError, logApiEvent } from "./operational-log.js";
import { createApiShutdown } from "./shutdown.js";

try {
  let server: ReturnType<typeof serve> | undefined;
  const controller = new AbortController();
  const preparation = prepareApi({ signal: controller.signal });
  const shutdown = createApiShutdown({
    closeHttp: () =>
      new Promise<void>((resolve, reject) => {
        if (!server) return resolve();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    stopRunner: async () => {
      controller.abort();
      const { runner } = await preparation;
      await runner.stop();
    },
    closeDatabase: closeDb,
  });
  process.on("SIGTERM", shutdown.stop);
  process.on("SIGINT", shutdown.stop);

  const { app, config } = await preparation;
  if (!shutdown.isStopping()) {
    server = serve(
      {
        fetch: (request, env) =>
          shutdown.handleRequest(() => app.fetch(request, env)),
        port: config.port,
      },
      () => logApiEvent("API_LISTENING"),
    );
  }
} catch (error) {
  logApiError("API_STARTUP_FAILED", error);
  process.exitCode = 1;
}
