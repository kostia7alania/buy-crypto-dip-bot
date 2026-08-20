import { withTenantContext } from "@buy-crypto-dip-bot/db";
import { createDefaultRiskGuard } from "@buy-crypto-dip-bot/risk-engine";
import { Hono } from "hono";
import { getDb } from "../../db.js";
import { listAuditEvents } from "../audit/audit.route.js";
import {
  type ProtectedApiEnv,
  requireProtectedApiContext,
} from "../auth/auth.middleware.js";
import { listOrders } from "../orders/orders.route.js";
import { computePerformanceReport } from "../performance/performance.route.js";
import { computePnlReport } from "../pnl/pnl.route.js";
import { getRunnerStatus } from "../runner/runner.service.js";
import { listStrategies } from "../strategies/strategies.route.js";

export const dashboardRoutes = new Hono<ProtectedApiEnv>()
  .use("*", requireProtectedApiContext)
  .get("/snapshot", async (c) => {
    const actor = c.get("tenantActor");
    try {
      const data = await withTenantContext(getDb(), actor, async (db) => ({
        strategies: await listStrategies(db, actor.tenantId),
        orders: await listOrders(db, actor.tenantId),
        audit: await listAuditEvents(db, actor.tenantId),
        pnl: await computePnlReport(db, actor.tenantId),
        performance: await computePerformanceReport(db, actor.tenantId),
      }));

      return c.json({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        risk: {
          ...createDefaultRiskGuard().getStatus(),
          runner: getRunnerStatus(),
        },
        ...data,
      });
    } catch (error) {
      console.error("Failed to build dashboard snapshot:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
