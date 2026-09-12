import { isAllowedSymbol } from "@buy-crypto-dip-bot/config";
import { createBybitPublicClient } from "@buy-crypto-dip-bot/exchange-bybit";
import { Hono } from "hono";
import * as v from "valibot";
import type { AppEnv } from "../auth/principal.middleware.js";

const symbolSchema = v.pipe(v.string(), v.regex(/^[A-Z0-9]{3,20}$/));

export const marketDataRoutes = new Hono<AppEnv>().get(
  "/:symbol/ticker",
  async (c) => {
    const parsedSymbol = v.safeParse(
      symbolSchema,
      c.req.param("symbol").toUpperCase(),
    );
    if (!parsedSymbol.success) {
      return c.json({ error: "INVALID_SYMBOL" }, 400);
    }

    const symbol = parsedSymbol.output;
    if (!isAllowedSymbol(symbol, process.env.ALLOWLIST_SYMBOLS)) {
      return c.json({ error: "SYMBOL_NOT_ALLOWED" }, 400);
    }

    const client = createBybitPublicClient({
      baseUrl: "https://api.bybit.com",
    });
    return c.json(await client.getTicker(symbol));
  },
);
