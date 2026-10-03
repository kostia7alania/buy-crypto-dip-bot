import {
  createCorrelationId,
  logOperationalError,
  logOperationalEvent,
} from "@buy-crypto-dip-bot/shared-types";
import { fetchBotHeartbeatApi } from "./runtime-config.js";

export const BOT_HEARTBEAT_INTERVAL_MS = 30_000;
export const BOT_HEARTBEAT_TIMEOUT_MS = 5_000;

export const publishBotHeartbeat = async (
  signal?: AbortSignal,
): Promise<boolean> => {
  const correlationId = createCorrelationId();
  const controller = new AbortController();
  const deadline = setTimeout(
    () => controller.abort(),
    BOT_HEARTBEAT_TIMEOUT_MS,
  );
  try {
    const response = await fetchBotHeartbeatApi({
      method: "POST",
      headers: { "x-request-id": correlationId },
      signal: signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal,
    });
    if (!response.ok) {
      logOperationalEvent({
        service: "BOT",
        event: "BOT_HEARTBEAT_REJECTED",
        level: "WARN",
        correlationId,
      });
      return false;
    }
    return true;
  } catch (error) {
    if (signal?.aborted) return false;
    logOperationalError({
      service: "BOT",
      event: "BOT_HEARTBEAT_FAILED",
      correlationId,
      error,
    });
    return false;
  } finally {
    controller.abort();
    clearTimeout(deadline);
  }
};

export const startBotHeartbeat = (): (() => Promise<void>) => {
  const controller = new AbortController();
  let active: Promise<void> | undefined;
  let stopped: Promise<void> | undefined;
  const publish = () => {
    if (controller.signal.aborted || active) return;
    active = publishBotHeartbeat(controller.signal)
      .then(() => undefined)
      .finally(() => {
        active = undefined;
      });
  };
  publish();
  const intervalId = setInterval(publish, BOT_HEARTBEAT_INTERVAL_MS);
  return () => {
    if (!stopped) {
      clearInterval(intervalId);
      controller.abort();
      stopped = active ?? Promise.resolve();
    }
    return stopped;
  };
};
