import {
  createCorrelationId,
  logOperationalError,
  logOperationalEvent,
} from "@buy-crypto-dip-bot/shared-types";
import { fetchBotHeartbeatApi } from "./runtime-config.js";

export const BOT_HEARTBEAT_INTERVAL_MS = 30_000;

export const publishBotHeartbeat = async (): Promise<boolean> => {
  const correlationId = createCorrelationId();
  try {
    const response = await fetchBotHeartbeatApi({
      method: "POST",
      headers: { "x-request-id": correlationId },
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
    logOperationalError({
      service: "BOT",
      event: "BOT_HEARTBEAT_FAILED",
      correlationId,
      error,
    });
    return false;
  }
};

export const startBotHeartbeat = (): (() => void) => {
  void publishBotHeartbeat();
  const intervalId = setInterval(() => {
    void publishBotHeartbeat();
  }, BOT_HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(intervalId);
};
