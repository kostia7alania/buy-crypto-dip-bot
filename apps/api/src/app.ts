import {
  logOperationalEvent,
  normalizeCorrelationId,
} from "@buy-crypto-dip-bot/shared-types";
import { Hono } from "hono";
import { auditRoutes } from "./modules/audit/audit.route.js";
import { authRoutes } from "./modules/auth/auth.route.js";
import {
  type AppEnv,
  tenantDatabaseMiddleware,
  userPrincipalMiddleware,
} from "./modules/auth/principal.middleware.js";
import { backtestRoutes } from "./modules/backtest/backtest.route.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.route.js";
import { createHealthRoutes } from "./modules/health/health.route.js";
import { marketDataRoutes } from "./modules/market-data/market-data.route.js";
import { ordersRoutes } from "./modules/orders/orders.route.js";
import { performanceRoutes } from "./modules/performance/performance.route.js";
import { pnlRoutes } from "./modules/pnl/pnl.route.js";
import { riskRoutes } from "./modules/risk/risk.route.js";
import { strategiesRoutes } from "./modules/strategies/strategies.route.js";
import { versionRoutes } from "./modules/version/version.route.js";
import { logApiError } from "./operational-log.js";
import { type ApiRuntime, classifyApiRuntime } from "./runtime-config.js";

interface CreateAppOptions {
  apiKey?: string | undefined;
  botHeartbeatSecret?: string | undefined;
  runtime?: ApiRuntime;
}

export const createApp = (options: CreateAppOptions = {}) => {
  const app = new Hono<AppEnv>();
  const runtime = options.runtime ?? classifyApiRuntime();
  const apiKey = options.apiKey ?? (process.env.API_KEY?.trim() || undefined);
  const botHeartbeatSecret =
    options.botHeartbeatSecret ??
    (process.env.BOT_HEARTBEAT_SECRET?.trim() || undefined);

  if (runtime === "non-local" && !apiKey) {
    throw new Error("API_RUNTIME_CONFIG_INVALID:API_KEY_REQUIRED");
  }
  if (runtime === "non-local" && !botHeartbeatSecret) {
    throw new Error("API_RUNTIME_CONFIG_INVALID:BOT_HEARTBEAT_SECRET_REQUIRED");
  }
  if (botHeartbeatSecret && botHeartbeatSecret.length < 32) {
    throw new Error(
      "API_RUNTIME_CONFIG_INVALID:BOT_HEARTBEAT_SECRET_TOO_SHORT",
    );
  }

  app.use("*", async (c, next) => {
    const correlationId = normalizeCorrelationId(c.req.header("x-request-id"));
    c.set("correlationId", correlationId);
    c.header("x-request-id", correlationId);
    await next();
  });

  // Layer 1 — service authentication. Proves the request came from our own
  // BFF or runner. Enforced only when API_KEY is set (i.e. on a VPS); local
  // dev without the variable stays open. /health stays public for uptime
  // probes.
  app.use("*", async (c, next) => {
    const isPublicHealth =
      c.req.method === "GET" &&
      (c.req.path === "/health" || c.req.path.startsWith("/health/"));
    if (isPublicHealth || (!apiKey && runtime === "local")) return next();
    if (c.req.header("x-api-key") !== apiKey) {
      logOperationalEvent({
        service: "API",
        event: "SERVICE_AUTH_REJECTED",
        level: "WARN",
        correlationId: c.get("correlationId"),
      });
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    return next();
  });

  // Layer 2 — user authorization. Service auth above says *what* is calling;
  // this says *who* for. Every route that touches user-owned rows requires a
  // live session, so a leaked API key on its own reads nobody's data.
  app.use("*", userPrincipalMiddleware());
  app.use("*", tenantDatabaseMiddleware());

  // Hono's default boundary prints the complete Error object. Database and
  // fetch errors can retain query parameters, headers, URLs, and request
  // payloads, so every uncaught route failure terminates at this safe mapper.
  app.onError((error, c) => {
    logApiError("UNHANDLED_REQUEST_FAILED", error, c.get("correlationId"));
    return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
  });

  app.route(
    "/health",
    createHealthRoutes({
      botHeartbeatSecret,
      allowUncredentialedLocalHeartbeat:
        runtime === "local" && !botHeartbeatSecret,
    }),
  );
  app.route("/version", versionRoutes);
  app.route("/market", marketDataRoutes);
  app.route("/risk", riskRoutes);
  app.route("/orders", ordersRoutes);
  app.route("/pnl", pnlRoutes);
  app.route("/performance", performanceRoutes);
  app.route("/backtest", backtestRoutes);
  app.route("/audit", auditRoutes);
  app.route("/auth", authRoutes);
  app.route("/strategies", strategiesRoutes);
  app.route("/dashboard", dashboardRoutes);
  return app;
};
