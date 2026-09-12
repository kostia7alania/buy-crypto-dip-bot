import { describe, expect, it } from "vitest";
import { getAllowedSymbols, isAllowedSymbol } from "./index.js";

describe("reviewed symbol policy", () => {
  it("allows the reviewed defaults but not meme coins or arbitrary pairs", () => {
    expect(getAllowedSymbols()).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
    for (const symbol of ["PEPEUSDT", "SHIBUSDT", "DOGEUSDT", "LTCUSDT"]) {
      expect(isAllowedSymbol(symbol)).toBe(false);
    }
  });

  it("allows deployment configuration to narrow, never expand policy", () => {
    expect(getAllowedSymbols(" ethusdt, PEPEUSDT, ETHUSDT ")).toEqual([
      "ETHUSDT",
    ]);
    expect(isAllowedSymbol("BTCUSDT", "ETHUSDT")).toBe(false);
    expect(isAllowedSymbol("PEPEUSDT", "PEPEUSDT")).toBe(false);
    expect(getAllowedSymbols("")).toEqual([]);
    expect(getAllowedSymbols("SHIBUSDT")).toEqual([]);
  });
});
