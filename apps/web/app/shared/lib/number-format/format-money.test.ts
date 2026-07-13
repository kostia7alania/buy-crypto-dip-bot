import { describe, expect, it } from "vitest";
import { formatMoney } from "./format-money.js";

describe("formatMoney", () => {
  it("uses the same locale and precision during SSR and hydration", () => {
    expect(formatMoney(1234.5)).toBe("1,234.50");
  });
});
