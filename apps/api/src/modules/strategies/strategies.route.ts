import { isAllowedSymbol, strategyDefaults } from "@buy-crypto-dip-bot/config";
import { auditEventRow, schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { AUDIT_SCHEMA_VERSION } from "@buy-crypto-dip-bot/shared-types";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { logApiError } from "../../operational-log.js";
import {
  type AppEnv,
  requireTenantDb,
  requireUser,
} from "../auth/principal.middleware.js";

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

export const listStrategies = (
  db: Pick<ReturnType<typeof requireTenantDb>, "select">,
  userId: string,
) =>
  db
    .select()
    .from(schema.strategies)
    .where(eq(schema.strategies.userId, userId))
    .orderBy(schema.strategies.symbol);

export const strategiesRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const user = requireUser(c);
    try {
      const db = requireTenantDb(c);
      const list = await listStrategies(db, user.userId);
      return c.json(list);
    } catch (error) {
      logApiError("STRATEGY_LIST_FAILED", error, c.get("correlationId"));
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  })
  .post("/", async (c) => {
    const user = requireUser(c);
    try {
      const body = await c.req.json();
      const parsed = v.safeParse(addStrategySchema, body);
      if (!parsed.success) {
        return c.json({ error: "INVALID_SYMBOL_FORMAT" }, 400);
      }

      const symbol = parsed.output.symbol.toUpperCase();
      if (!isAllowedSymbol(symbol, process.env.ALLOWLIST_SYMBOLS)) {
        return c.json({ error: "SYMBOL_NOT_ALLOWED" }, 400);
      }
      const db = requireTenantDb(c);

      // 1. Uniqueness is per user, not global: two people are both entitled
      //    to their own BTCUSDT strategy.
      const existing = await db
        .select()
        .from(schema.strategies)
        .where(
          and(
            eq(schema.strategies.userId, user.userId),
            eq(schema.strategies.symbol, symbol),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return c.json({ error: "STRATEGY_ALREADY_EXISTS" }, 400);
      }

      // 2. Validate token on Bybit Spot
      const client = createBybitPublicClient({
        baseUrl: "https://api.bybit.com",
      });
      try {
        const ticker = await client.getTicker(symbol);
        if (!ticker?.lastPrice) {
          return c.json({ error: "SYMBOL_NOT_FOUND_ON_EXCHANGE" }, 400);
        }
      } catch (_error) {
        return c.json({ error: "SYMBOL_NOT_FOUND_ON_EXCHANGE" }, 400);
      }

      // 3. Create default strategy, owned by the caller
      const newStrategy = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(schema.strategies)
          .values({
            userId: user.userId,
            name: `${symbol} Dip Buying Strategy`,
            symbol,
            mode: "DRY_RUN",
            config: { ...strategyDefaults },
          })
          .returning();
        if (!created) throw new Error("strategy insert returned no row");
        await tx.insert(schema.auditEvents).values(
          auditEventRow({
            schemaVersion: AUDIT_SCHEMA_VERSION,
            type: "STRATEGY_CREATED",
            scope: "USER",
            userId: user.userId,
            actor: {
              kind: "USER",
              channel: user.sessionKind === "BOT_COMMAND" ? "TELEGRAM" : "WEB",
              userId: user.userId,
            },
            reasonCode: "USER_REQUESTED",
            correlationId: c.get("correlationId"),
            subject: { type: "STRATEGY", id: created.id },
            payloadClass: "TENANT_CONFIGURATION",
            payload: { symbol: created.symbol, mode: "DRY_RUN" },
          }),
        );
        return created;
      });

      return c.json({ success: true, strategy: newStrategy });
    } catch (error) {
      logApiError("STRATEGY_CREATE_FAILED", error, c.get("correlationId"));
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  })
  .patch("/:id", async (c) => {
    const user = requireUser(c);
    const id = c.req.param("id");
    try {
      const body = await c.req.json();
      const parsed = v.safeParse(updateStrategySchema, body);
      if (!parsed.success) {
        return c.json({ error: "INVALID_UPDATE_PAYLOAD" }, 400);
      }
      const auditFields = [
        ...(parsed.output.enabled !== undefined ? (["enabled"] as const) : []),
        ...Object.keys(parsed.output.config ?? {}),
      ] as Array<
        | "enabled"
        | "thresholdPercent"
        | "suggestedQuoteAmount"
        | "maxDailySpendUsdt"
        | "maxWeeklySpendUsdt"
        | "cooldownMinutes"
      >;
      if (auditFields.length === 0) {
        return c.json({ error: "INVALID_UPDATE_PAYLOAD" }, 400);
      }

      const db = requireTenantDb(c);
      // Ownership is part of the lookup, so a strategy belonging to someone
      // else is indistinguishable from one that does not exist. Returning 403
      // here would confirm the id is real — itself a cross-tenant leak.
      const [existing] = await db
        .select()
        .from(schema.strategies)
        .where(
          and(
            eq(schema.strategies.id, id),
            eq(schema.strategies.userId, user.userId),
          ),
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: "STRATEGY_NOT_FOUND" }, 404);
      }

      if (
        parsed.output.enabled === true &&
        !isAllowedSymbol(existing.symbol, process.env.ALLOWLIST_SYMBOLS)
      ) {
        return c.json({ error: "SYMBOL_NOT_ALLOWED" }, 400);
      }

      const updates: {
        enabled?: boolean;
        config?: Record<string, unknown>;
      } = {};
      if (parsed.output.enabled !== undefined) {
        updates.enabled = parsed.output.enabled;
      }
      if (parsed.output.config !== undefined) {
        const existingConfig =
          typeof existing.config === "object" &&
          existing.config !== null &&
          !Array.isArray(existing.config)
            ? (existing.config as Record<string, unknown>)
            : {};
        updates.config = {
          ...existingConfig,
          ...parsed.output.config,
        };
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(schema.strategies)
          .set(updates)
          .where(
            and(
              eq(schema.strategies.id, id),
              eq(schema.strategies.userId, user.userId),
            ),
          )
          .returning();
        if (!row) throw new Error("owned strategy disappeared during update");
        await tx.insert(schema.auditEvents).values(
          auditEventRow({
            schemaVersion: AUDIT_SCHEMA_VERSION,
            type: "STRATEGY_UPDATED",
            scope: "USER",
            userId: user.userId,
            actor: {
              kind: "USER",
              channel: user.sessionKind === "BOT_COMMAND" ? "TELEGRAM" : "WEB",
              userId: user.userId,
            },
            reasonCode: "USER_REQUESTED",
            correlationId: c.get("correlationId"),
            subject: { type: "STRATEGY", id: row.id },
            payloadClass: "TENANT_CONFIGURATION",
            payload: { fields: auditFields },
          }),
        );
        return row;
      });

      return c.json({ success: true, strategy: updated });
    } catch (error) {
      logApiError("STRATEGY_UPDATE_FAILED", error, c.get("correlationId"));
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });
