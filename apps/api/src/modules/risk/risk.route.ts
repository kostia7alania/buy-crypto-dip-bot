import { createDefaultRiskGuard } from "@buy-crypto-dip-bot/risk-engine";
import { Hono } from "hono";
export const riskRoutes = new Hono().get("/status", (c) =>
  c.json(createDefaultRiskGuard().getStatus()),
);
