import { describe, expect, it } from "vitest";
import {
  renderTelegramFallback,
  renderTelegramTemplate,
  TELEGRAM_TEMPLATE_VERSION,
} from "./telegram-template.js";

describe("versioned Telegram templates", () => {
  it("escapes every untrusted text field before enabling HTML parse mode", () => {
    const rendered = renderTelegramTemplate({
      version: TELEGRAM_TEMPLATE_VERSION,
      key: "RISK_REJECTED",
      inputs: {
        strategyName: "<b>other tenant</b> & mine",
        symbol: "BTCUSDT",
        price: 100_000,
        reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
      },
    });

    expect(rendered.parseMode).toBe("HTML");
    expect(rendered.text).toContain(
      "&lt;b&gt;other tenant&lt;/b&gt; &amp; mine",
    );
    expect(rendered.text).not.toContain("<b>other tenant</b>");
  });

  it("rejects unknown inputs instead of persisting or rendering them", () => {
    expect(() =>
      renderTelegramTemplate({
        version: TELEGRAM_TEMPLATE_VERSION,
        key: "RISK_REJECTED",
        inputs: {
          strategyName: "BTC Dip",
          symbol: "BTCUSDT",
          price: 100_000,
          reasonCodes: ["DAILY_LIMIT_EXCEEDED"],
          privateApiKey: "must-never-be-accepted",
        },
      }),
    ).toThrow("TELEGRAM_TEMPLATE_INVALID:RISK_INPUT_KEYS");
  });

  it("renders a detail-free fallback with only a safe audit reference", () => {
    const rendered = renderTelegramFallback("runner_tick_1234");

    expect(rendered.text).toContain("runner_tick_1234");
    expect(rendered.text).not.toMatch(/BTC|USDT|strategy|price/i);
  });

  it("does not reflect an invalid fallback reference", () => {
    const rendered = renderTelegramFallback("<script>leak()</script>");

    expect(rendered.text).toContain("reference-unavailable");
    expect(rendered.text).not.toContain("script");
  });
});
