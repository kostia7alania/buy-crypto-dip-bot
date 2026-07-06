import { createDefaultRiskGuard } from "@buy-crypto-dip-bot/risk-engine";
import { Hono } from "hono";
import { getRunnerStatus } from "../runner/runner.service.js";

export const riskRoutes = new Hono().get("/status", (c) =>
  c.json({
    ...createDefaultRiskGuard().getStatus(),
    runner: getRunnerStatus(),
  }),
);
