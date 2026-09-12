import { timingSafeEqual } from "node:crypto";
import { logOperationalEvent } from "@buy-crypto-dip-bot/shared-types";
import { Hono } from "hono";
import {
  getRuntimeReadiness,
  markBotHeartbeat,
} from "../../runtime-readiness.js";
import type { AppEnv } from "../auth/principal.middleware.js";

const heartbeatSecretMatches = (
  provided: string | undefined,
  expected: string,
): boolean => {
  if (!provided) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
};

interface HealthRoutesOptions {
  botHeartbeatSecret?: string | undefined;
  allowUncredentialedLocalHeartbeat: boolean;
}

export const createHealthRoutes = (options: HealthRoutesOptions) =>
  new Hono<AppEnv>()
    .get("/", (c) => c.json({ ok: true, service: "api" }))
    .get("/ready", (c) => {
      const readiness = getRuntimeReadiness();
      return c.json(readiness, readiness.state === "ready" ? 200 : 503);
    })
    .post("/bot-heartbeat", (c) => {
      const authorized = options.botHeartbeatSecret
        ? heartbeatSecretMatches(
            c.req.header("x-bot-heartbeat-secret"),
            options.botHeartbeatSecret,
          )
        : options.allowUncredentialedLocalHeartbeat;
      if (!authorized) {
        logOperationalEvent({
          service: "API",
          event: "BOT_HEARTBEAT_AUTH_REJECTED",
          level: "WARN",
          correlationId: c.get("correlationId"),
        });
        return c.json({ error: "UNAUTHORIZED" }, 401);
      }
      markBotHeartbeat();
      return c.body(null, 204);
    })
    .get("/version", (c) =>
      c.json({ name: "buy-crypto-dip-bot", runtime: process.version }),
    );
