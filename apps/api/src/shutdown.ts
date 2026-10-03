import { logApiError, logApiEvent } from "./operational-log.js";
import { markStopping } from "./runtime-readiness.js";

export const API_SHUTDOWN_TIMEOUT_MS = 25_000;

interface ApiShutdownOptions {
  closeHttp: () => Promise<void>;
  stopRunner: () => Promise<void>;
  closeDatabase: () => Promise<void>;
  exit?: (code: number) => void;
}

export const createApiShutdown = (options: ApiShutdownOptions) => {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const requests = new Set<Promise<void>>();
  let completion: Promise<void> | undefined;

  const handleRequest = async (
    fetch: () => Response | Promise<Response>,
  ): Promise<Response> => {
    if (completion) {
      return Response.json(
        { error: "API_STOPPING" },
        { status: 503, headers: { connection: "close" } },
      );
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    requests.add(promise);
    try {
      return await fetch();
    } finally {
      requests.delete(promise);
      resolve();
    }
  };

  const stop = (): Promise<void> => {
    if (completion) return completion;
    const { promise, resolve } = Promise.withResolvers<void>();
    completion = promise;
    markStopping();
    logApiEvent("API_SHUTDOWN_STARTED");
    let finished = false;

    const deadline = setTimeout(() => {
      finished = true;
      logApiEvent("API_SHUTDOWN_TIMED_OUT", "ERROR");
      resolve();
      exit(1);
    }, API_SHUTDOWN_TIMEOUT_MS);

    const drain = async () => {
      // Closing sockets alone does not await handlers of disconnected clients.
      // Start both drains now; neither may wait for the other to begin.
      const results = await Promise.allSettled([
        (async () => options.closeHttp())(),
        (async () => options.stopRunner())(),
        ...requests,
      ]);
      if (finished) return;
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
      }
      await options.closeDatabase();
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      logApiEvent("API_SHUTDOWN_COMPLETED");
      resolve();
      exit(0);
    };

    void drain().catch((error: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      logApiError("API_SHUTDOWN_FAILED", error);
      resolve();
      exit(1);
    });
    return completion;
  };

  return { stop, handleRequest, isStopping: () => Boolean(completion) };
};
