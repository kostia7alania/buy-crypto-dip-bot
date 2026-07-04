import { schema } from "@buy-crypto-dip-bot/db";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import { getDb } from "../../db.js";

const symbolSchema = v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/));
const staticAllowedSymbols = new Set(
  (process.env.ALLOWLIST_SYMBOLS ?? "BTCUSDT,ETHUSDT,SOLUSDT")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean),
);

export const marketDataRoutes = new Hono().get("/:symbol/ticker", async (c) => {
  const parsedSymbol = v.safeParse(
    symbolSchema,
    c.req.param("symbol").toUpperCase(),
  );
  if (!parsedSymbol.success) {
    return c.json({ error: "INVALID_SYMBOL" }, 400);
  }

  const symbol = parsedSymbol.output;
  const isStaticAllowed = staticAllowedSymbols.has(symbol);

  let hasStrategy = false;
  if (!isStaticAllowed) {
    try {
      const db = getDb();
      const existing = await db
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.symbol, symbol))
        .limit(1);
      hasStrategy = existing.length > 0;
    } catch (err) {
      console.error(
        "Failed to query strategies from DB for ticker check:",
        err,
      );
    }
  }

  if (!isStaticAllowed && !hasStrategy) {
    return c.json({ error: "SYMBOL_NOT_ALLOWED" }, 400);
  }

  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });
  return c.json(await client.getTicker(symbol));
});
