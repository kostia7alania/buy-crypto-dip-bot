import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { Hono } from "hono";
import * as v from "valibot";

const symbolSchema = v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/));

export const marketDataRoutes = new Hono().get("/:symbol/ticker", async (c) => {
  const parsedSymbol = v.safeParse(
    symbolSchema,
    c.req.param("symbol").toUpperCase(),
  );
  if (!parsedSymbol.success) {
    return c.json({ error: "INVALID_SYMBOL" }, 400);
  }

  const symbol = parsedSymbol.output;
  const client = createBybitPublicClient({ baseUrl: "https://api.bybit.com" });
  try {
    return c.json(await client.getTicker(symbol));
  } catch (error) {
    console.error(`Bybit rejected ticker symbol ${symbol}:`, error);
    return c.json({ error: "SYMBOL_NOT_FOUND" }, 404);
  }
});
