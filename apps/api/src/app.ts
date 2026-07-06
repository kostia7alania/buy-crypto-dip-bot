import { Hono } from "hono";
import { auditRoutes } from "./modules/audit/audit.route.js";
import { healthRoutes } from "./modules/health/health.route.js";
import { marketDataRoutes } from "./modules/market-data/market-data.route.js";
import { ordersRoutes } from "./modules/orders/orders.route.js";
import { riskRoutes } from "./modules/risk/risk.route.js";
import { strategiesRoutes } from "./modules/strategies/strategies.route.js";
import { versionRoutes } from "./modules/version/version.route.js";

export const createApp = () => {
  const app = new Hono();

  // API-key guard. Enforced only when API_KEY is set (i.e. on a VPS);
  // local dev without the variable stays open. /health stays public for
  // uptime probes.
  app.use("*", async (c, next) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || c.req.path === "/health") return next();
    if (c.req.header("x-api-key") !== apiKey) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    return next();
  });

  app.route("/health", healthRoutes);
  app.route("/version", versionRoutes);
  app.route("/market", marketDataRoutes);
  app.route("/risk", riskRoutes);
  app.route("/orders", ordersRoutes);
  app.route("/audit", auditRoutes);
  app.route("/strategies", strategiesRoutes);
  return app;
};
