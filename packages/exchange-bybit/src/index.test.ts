import { describe, expect, it } from "vitest";
import { BybitPublicDataError, createBybitPublicClient } from "./index.js";

const NOW = 1_723_000_000_000;
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const tickerBody = (overrides: Record<string, unknown> = {}) => ({
  retCode: 0,
  retMsg: "OK",
  time: NOW - 250,
  result: {
    category: "spot",
    list: [
      {
        symbol: "BTCUSDT",
        lastPrice: "60000.25",
        highPrice24h: "61000",
        lowPrice24h: "59000",
      },
    ],
  },
  ...overrides,
});

const clientFor = (body: unknown) =>
  createBybitPublicClient({
    baseUrl: "https://api.bybit.com",
    fetchFn: async () => response(body),
    now: () => NOW,
    marketDataTtlMs: 30_000,
  });

describe("Bybit public market-data contract", () => {
  it("returns a typed ticker with explicit freshness evidence", async () => {
    await expect(clientFor(tickerBody()).getTicker("BTCUSDT")).resolves.toEqual(
      {
        symbol: "BTCUSDT",
        lastPrice: 60_000.25,
        high24h: 61_000,
        low24h: 59_000,
        sourceAt: new Date(NOW - 250).toISOString(),
        receivedAt: new Date(NOW).toISOString(),
        ageMs: 250,
        ttlMs: 30_000,
      },
    );
  });

  it.each([
    [
      "missing price",
      tickerBody({
        result: { category: "spot", list: [{ symbol: "BTCUSDT" }] },
      }),
      "INVALID_RESPONSE",
    ],
    [
      "non-finite price",
      tickerBody({
        result: {
          category: "spot",
          list: [
            {
              symbol: "BTCUSDT",
              lastPrice: "Infinity",
              highPrice24h: "1",
              lowPrice24h: "1",
            },
          ],
        },
      }),
      "INVALID_NUMBER",
    ],
    [
      "negative price",
      tickerBody({
        result: {
          category: "spot",
          list: [
            {
              symbol: "BTCUSDT",
              lastPrice: "-1",
              highPrice24h: "1",
              lowPrice24h: "1",
            },
          ],
        },
      }),
      "INVALID_NUMBER",
    ],
    [
      "wrong symbol",
      tickerBody({
        result: {
          category: "spot",
          list: [
            {
              symbol: "ETHUSDT",
              lastPrice: "1",
              highPrice24h: "1",
              lowPrice24h: "1",
            },
          ],
        },
      }),
      "SYMBOL_MISMATCH",
    ],
    ["stale source time", tickerBody({ time: NOW - 30_001 }), "STALE_RESPONSE"],
    [
      "an impossible 24-hour range",
      tickerBody({
        result: {
          category: "spot",
          list: [
            {
              symbol: "BTCUSDT",
              lastPrice: "60000",
              highPrice24h: "59000",
              lowPrice24h: "58000",
            },
          ],
        },
      }),
      "INVALID_RESPONSE",
    ],
    [
      "an upstream rejection without a result",
      { retCode: 10_001, retMsg: "request rejected", time: NOW },
      "UPSTREAM_REJECTED",
    ],
  ])("rejects %s with typed evidence", async (_name, body, code) => {
    const promise = clientFor(body).getTicker("BTCUSDT");
    await expect(promise).rejects.toBeInstanceOf(BybitPublicDataError);
    await expect(promise).rejects.toMatchObject({ code });
  });

  it("validates and chronologically sorts complete candle rows", async () => {
    const client = clientFor({
      retCode: 0,
      retMsg: "OK",
      time: NOW,
      result: {
        category: "spot",
        symbol: "BTCUSDT",
        list: [
          ["2000", "11", "13", "10", "12", "1", "1"],
          ["1000", "10", "12", "9", "11", "1", "1"],
        ],
      },
    });

    await expect(
      client.getKlines({ symbol: "BTCUSDT", interval: "D" }),
    ).resolves.toEqual({
      candles: [
        { openTime: 1000, open: 10, high: 12, low: 9, close: 11 },
        { openTime: 2000, open: 11, high: 13, low: 10, close: 12 },
      ],
      sourceAt: new Date(NOW).toISOString(),
      receivedAt: new Date(NOW).toISOString(),
      ageMs: 0,
      ttlMs: 30_000,
    });
  });

  it.each([
    ["future candle", String(NOW + 5_001), undefined],
    ["cursor-violating candle", "2000", 1999],
  ])("rejects a %s", async (_name, openTime, end) => {
    const client = clientFor({
      retCode: 0,
      retMsg: "OK",
      time: NOW,
      result: {
        category: "spot",
        symbol: "BTCUSDT",
        list: [[openTime, "10", "12", "9", "11", "1", "1"]],
      },
    });

    await expect(
      client.getKlines({
        symbol: "BTCUSDT",
        interval: "D",
        ...(end === undefined ? {} : { end }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_CANDLE" });
  });
});
