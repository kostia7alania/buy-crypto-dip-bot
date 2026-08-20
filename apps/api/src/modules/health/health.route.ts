import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../../db.js";
import { getRunnerStatus } from "../runner/runner.service.js";

const runnerIsReady = () => {
  const status = getRunnerStatus();
  if (status.tickIntervalMs === 0) return true;
  const lastTickAt = Date.parse(status.lastTickAt ?? "");
  return (
    Number.isFinite(lastTickAt) &&
    Date.now() - lastTickAt <= Math.max(status.tickIntervalMs * 3, 90_000)
  );
};

export const healthRoutes = new Hono()
  .get("/", async (c) => {
    try {
      await getDb().execute(sql`select 1`);
      if (!runnerIsReady()) {
        return c.json(
          { ok: false, service: "api", reason: "RUNNER_NOT_READY" },
          503,
        );
      }
      return c.json({ ok: true, service: "api" });
    } catch (error) {
      console.error("Health check failed:", error);
      return c.json(
        { ok: false, service: "api", reason: "DATABASE_NOT_READY" },
        503,
      );
    }
  })
  .get("/version", (c) =>
    c.json({ name: "buy-crypto-dip-bot", runtime: process.version }),
  );
