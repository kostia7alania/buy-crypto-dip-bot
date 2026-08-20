import { strategyDefaults } from "@buy-crypto-dip-bot/config";
import { schema, withTenantContext } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { getDb, type TenantDb } from "../../db.js";
import {
  type ProtectedApiEnv,
  requireProtectedApiContext,
} from "../auth/auth.middleware.js";

const addStrategySchema = v.object({
  symbol: v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/)),
});

const updateStrategySchema = v.object({
  enabled: v.optional(v.boolean()),
  config: v.optional(
    v.object({
      thresholdPercent: v.optional(v.number()),
      suggestedQuoteAmount: v.optional(v.number()),
      maxDailySpendUsdt: v.optional(v.number()),
      maxWeeklySpendUsdt: v.optional(v.number()),
      cooldownMinutes: v.optional(v.number()),
    }),
  ),
});

export const listStrategies = (db: TenantDb, tenantId: string) =>
  db
    .select()
    .from(schema.strategies)
    .where(eq(schema.strategies.tenantId, tenantId))
    .orderBy(schema.strategies.symbol);

export const strategiesRoutes = new Hono<ProtectedApiEnv>()
  .use("*", requireProtectedApiContext)
  .get("/", async (c) => {
    const actor = c.get("tenantActor");
    try {
      const list = await withTenantContext(getDb(), actor, (db) =>
        listStrategies(db, actor.tenantId),
      );
      return c.json(list);
    } catch (error) {
      console.error("Failed to list strategies:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  })
  .post("/", async (c) => {
    const actor = c.get("tenantActor");
    try {
      const body: unknown = await c.req.json();
      const parsed = v.safeParse(addStrategySchema, body);
      if (!parsed.success) {
        return c.json({ error: "INVALID_SYMBOL_FORMAT" }, 400);
      }

      const symbol = parsed.output.symbol.toUpperCase();
      try {
        const ticker = await createBybitPublicClient({
          baseUrl: "https://api.bybit.com",
        }).getTicker(symbol);
        if (!ticker.lastPrice) {
          return c.json({ error: "SYMBOL_NOT_FOUND_ON_EXCHANGE" }, 400);
        }
      } catch {
        return c.json({ error: "SYMBOL_NOT_FOUND_ON_EXCHANGE" }, 400);
      }

      const created = await withTenantContext(getDb(), actor, async (db) => {
        const [existing] = await db
          .select({ id: schema.strategies.id })
          .from(schema.strategies)
          .where(
            and(
              eq(schema.strategies.tenantId, actor.tenantId),
              eq(schema.strategies.symbol, symbol),
            ),
          )
          .limit(1);
        if (existing) return null;

        const [strategy] = await db
          .insert(schema.strategies)
          .values({
            tenantId: actor.tenantId,
            name: `${symbol} Dip Buying Strategy`,
            symbol,
            mode: "DRY_RUN",
            config: { ...strategyDefaults },
          })
          .returning();
        if (!strategy) throw new Error("STRATEGY_INSERT_FAILED");

        await db.insert(schema.auditEvents).values({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          entityType: "strategy",
          entityId: strategy.id,
          action: "STRATEGY_CREATED",
          payload: { symbol, mode: "DRY_RUN" },
        });
        return strategy;
      });

      if (!created) {
        return c.json({ error: "STRATEGY_ALREADY_EXISTS" }, 400);
      }
      return c.json({ success: true, strategy: created });
    } catch (error) {
      console.error("Failed to add strategy:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    const actor = c.get("tenantActor");
    const id = c.req.param("id");
    try {
      const body: unknown = await c.req.json();
      const parsed = v.safeParse(updateStrategySchema, body);
      if (!parsed.success) {
        return c.json({ error: "INVALID_UPDATE_PAYLOAD" }, 400);
      }

      const updated = await withTenantContext(getDb(), actor, async (db) => {
        const [existing] = await db
          .select()
          .from(schema.strategies)
          .where(
            and(
              eq(schema.strategies.id, id),
              eq(schema.strategies.tenantId, actor.tenantId),
            ),
          )
          .limit(1);
        if (!existing) return null;

        const updates: Partial<typeof schema.strategies.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (parsed.output.enabled !== undefined) {
          updates.enabled = parsed.output.enabled;
        }
        if (parsed.output.config !== undefined) {
          updates.config = {
            ...(existing.config as Record<string, unknown>),
            ...parsed.output.config,
          };
        }

        const [strategy] = await db
          .update(schema.strategies)
          .set(updates)
          .where(
            and(
              eq(schema.strategies.id, id),
              eq(schema.strategies.tenantId, actor.tenantId),
            ),
          )
          .returning();
        if (!strategy) return null;

        await db.insert(schema.auditEvents).values({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          entityType: "strategy",
          entityId: strategy.id,
          action: "STRATEGY_UPDATED",
          payload: { fields: Object.keys(parsed.output) },
        });
        return strategy;
      });

      if (!updated) {
        return c.json({ error: "STRATEGY_NOT_FOUND" }, 404);
      }
      return c.json({ success: true, strategy: updated });
    } catch (error) {
      console.error("Failed to update strategy:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
