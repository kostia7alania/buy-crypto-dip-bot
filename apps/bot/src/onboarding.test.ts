import { describe, expect, it } from "vitest";
import {
  buildAmountKeyboard,
  buildCoinKeyboard,
  buildConfirmKeyboard,
  buildThresholdKeyboard,
  parseWizardCallback,
  WIZARD_AMOUNTS,
  WIZARD_COINS,
  WIZARD_THRESHOLDS,
} from "./onboarding.js";

const callbackDataOf = (kb: { inline_keyboard: unknown[][] }) =>
  kb.inline_keyboard.flat().map((b: any) => b.callback_data as string);

describe("parseWizardCallback", () => {
  it("parses each step with valid values", () => {
    expect(parseWizardCallback("wiz:coin")).toEqual({ step: "coin" });
    expect(parseWizardCallback("wiz:cancel")).toEqual({ step: "cancel" });
    expect(parseWizardCallback("wiz:threshold:BTCUSDT")).toEqual({
      step: "threshold",
      symbol: "BTCUSDT",
    });
    expect(parseWizardCallback("wiz:amount:ETHUSDT:2")).toEqual({
      step: "amount",
      symbol: "ETHUSDT",
      thresholdPercent: 2,
    });
    expect(parseWizardCallback("wiz:confirm:SOLUSDT:5:100")).toEqual({
      step: "confirm",
      symbol: "SOLUSDT",
      thresholdPercent: 5,
      amountUsdt: 100,
    });
    expect(parseWizardCallback("wiz:apply:BTCUSDT:1:10")).toEqual({
      step: "apply",
      symbol: "BTCUSDT",
      thresholdPercent: 1,
      amountUsdt: 10,
    });
  });

  it("rejects data that is not from the wizard", () => {
    expect(parseWizardCallback("cancel_order:abc")).toBeNull();
    expect(parseWizardCallback("wiz:unknown")).toBeNull();
  });

  it("rejects forged values outside the fixed option lists", () => {
    expect(parseWizardCallback("wiz:threshold:DOGEUSDT")).toBeNull();
    expect(parseWizardCallback("wiz:amount:BTCUSDT:99")).toBeNull();
    expect(parseWizardCallback("wiz:apply:BTCUSDT:1:9999")).toBeNull();
    expect(parseWizardCallback("wiz:apply:BTCUSDT:not-a-number:10")).toBeNull();
  });
});

describe("wizard keyboards", () => {
  it("coin keyboard offers every allowlisted coin plus cancel", () => {
    const data = callbackDataOf(buildCoinKeyboard());
    for (const symbol of WIZARD_COINS) {
      expect(data).toContain(`wiz:threshold:${symbol}`);
    }
    expect(data).toContain("wiz:cancel");
  });

  it("threshold keyboard carries the chosen coin forward", () => {
    const data = callbackDataOf(buildThresholdKeyboard("ETHUSDT"));
    for (const t of WIZARD_THRESHOLDS) {
      expect(data).toContain(`wiz:amount:ETHUSDT:${t}`);
    }
  });

  it("amount keyboard carries coin and threshold forward", () => {
    const data = callbackDataOf(buildAmountKeyboard("BTCUSDT", 2));
    for (const a of WIZARD_AMOUNTS) {
      expect(data).toContain(`wiz:confirm:BTCUSDT:2:${a}`);
    }
  });

  it("confirm keyboard offers apply, restart, and cancel", () => {
    const data = callbackDataOf(buildConfirmKeyboard("SOLUSDT", 3, 50));
    expect(data).toContain("wiz:apply:SOLUSDT:3:50");
    expect(data).toContain("wiz:coin");
    expect(data).toContain("wiz:cancel");
  });

  it("every generated callback round-trips through the parser", () => {
    const all = [
      ...callbackDataOf(buildCoinKeyboard()),
      ...callbackDataOf(buildThresholdKeyboard("BTCUSDT")),
      ...callbackDataOf(buildAmountKeyboard("BTCUSDT", 1)),
      ...callbackDataOf(buildConfirmKeyboard("BTCUSDT", 1, 10)),
    ];
    for (const data of all) {
      expect(parseWizardCallback(data)).not.toBeNull();
      // Telegram hard-limits callback data to 64 bytes.
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    }
  });
});
