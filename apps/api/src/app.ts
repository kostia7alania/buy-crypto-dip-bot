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
  app.route("/health", healthRoutes);
  app.route("/version", versionRoutes);
  app.route("/market", marketDataRoutes);
  app.route("/risk", riskRoutes);
  app.route("/orders", ordersRoutes);
  app.route("/audit", auditRoutes);
  app.route("/strategies", strategiesRoutes);
  return app;
};
