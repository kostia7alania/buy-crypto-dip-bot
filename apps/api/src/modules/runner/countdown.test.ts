import { describe, expect, it } from "vitest";
import { buildPendingText, getCountdownSecondsLeft } from "./countdown.js";

describe("runner countdown", () => {
  it("reports real whole seconds remaining", () => {
    const executeAt = new Date("2026-07-13T12:00:15.000Z");

    expect(
      getCountdownSecondsLeft(
        executeAt,
        new Date("2026-07-13T12:00:00.000Z").getTime(),
      ),
    ).toBe(15);
    expect(
      getCountdownSecondsLeft(
        executeAt,
        new Date("2026-07-13T12:00:01.001Z").getTime(),
      ),
    ).toBe(14);
    expect(
      getCountdownSecondsLeft(
        executeAt,
        new Date("2026-07-13T12:00:15.001Z").getTime(),
      ),
    ).toBe(0);
  });

  it("renders the current second and deterministic price formatting", () => {
    const text = buildPendingText("BTC Dip", "BTCUSDT", 12345.5, 20, 14);

    expect(text).toContain("$12,345.5");
    expect(text).toContain("Executing in *14s*");
  });
});
