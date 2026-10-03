import { getAllowedSymbols } from "@buy-crypto-dip-bot/config";
import { createDefaultRiskGuard } from "@buy-crypto-dip-bot/risk-engine";
import { Hono } from "hono";
import { listAuditEvents } from "../audit/audit.route.js";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";
import { createReportMarketSnapshot } from "../market-data/report-snapshot.js";
import { listOrders } from "../orders/orders.route.js";
import {
  computePerformanceReport,
  finalizePerformanceReport,
} from "../performance/performance.route.js";
import { computePnlReport, finalizePnlReport } from "../pnl/pnl.route.js";
import { getRunnerStatus } from "../runner/runner.service.js";
import { listStrategies } from "../strategies/strategies.route.js";

export const dashboardRoutes = new Hono<AppEnv>().get(
  "/snapshot",
  async (c) => {
    const userId = requireUser(c).userId;
    const db = requireTenantDb(c);
    c.header("cache-control", "private, no-store");
    // One tenant transaction and the same readers as the individual endpoints.
    const strategies = await listStrategies(db, userId);
    const orders = await listOrders(db, userId);
    const audit = await listAuditEvents(db, userId);
    const market = createReportMarketSnapshot();
    const pnl = await computePnlReport(db, userId, market);
    const performance = await computePerformanceReport(db, userId, market);
    // Later provider calls may expire earlier quotes. Both reports share this cutoff.
    const asOf = Date.now();
    return c.json({
      schemaVersion: 1,
      generatedAt: new Date(asOf).toISOString(),
      risk: {
        ...createDefaultRiskGuard(
          getAllowedSymbols(process.env.ALLOWLIST_SYMBOLS),
        ).getStatus(),
        runner: getRunnerStatus(),
      },
      strategies,
      orders,
      audit,
      pnl: finalizePnlReport(pnl.positions, asOf),
      performance: finalizePerformanceReport(performance.positions, asOf),
    });
  },
);
