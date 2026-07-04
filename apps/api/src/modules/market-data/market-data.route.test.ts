import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

describe("market data routes", () => {
  it("rejects malformed symbols before exchange access", async () => {
    const res = await createApp().request("/market/btc-usdt/ticker");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_SYMBOL" });
  });
});
