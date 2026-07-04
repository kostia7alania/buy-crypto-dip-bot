import { describe, expect, it } from "vitest";
import { riskStatus } from "./risk-status.js";

describe("risk status BFF contract", () => {
  it("defaults dashboard data to dry-run safe mode", () => {
    expect(riskStatus).toMatchObject({
      mode: "DRY_RUN",
      liveTradingEnabled: false,
      orderLikeActionsRequireApproval: true,
    });
  });
});
