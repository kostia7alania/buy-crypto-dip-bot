import { describe, expect, it } from "vitest";
import { getBudgetReadState } from "./budget.js";

const asOf = "2026-11-18T10:00:00.000Z";
const timestamp = Date.parse(asOf);
const fresh = { asOf, strategies: [] };

describe("strategy budget freshness", () => {
  it("keeps current zero/empty budgets distinct from unavailable data", () => {
    expect(getBudgetReadState(fresh, timestamp + 30_000, false)).toBe(
      "current",
    );
    expect(getBudgetReadState(undefined, timestamp, false)).toBe("unavailable");
    expect(getBudgetReadState(fresh, timestamp, true)).toBe("unavailable");
  });

  it("hides out-of-date or unusable snapshots", () => {
    expect(getBudgetReadState(fresh, timestamp + 60_000, false)).toBe("stale");
    expect(getBudgetReadState(fresh, timestamp - 60_000, false)).toBe(
      "unavailable",
    );
    expect(
      getBudgetReadState({ ...fresh, asOf: "bad" }, timestamp, false),
    ).toBe("unavailable");
  });
});
