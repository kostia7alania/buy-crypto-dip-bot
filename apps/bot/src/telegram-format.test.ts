import { describe, expect, it } from "vitest";
import {
  escapeTelegramHtml,
  escapeTelegramMarkdown,
} from "./telegram-format.js";

describe("direct Telegram command formatting", () => {
  it("escapes user-controlled HTML", () => {
    expect(escapeTelegramHtml("<b>A & B</b>")).toBe(
      "&lt;b&gt;A &amp; B&lt;/b&gt;",
    );
  });

  it("escapes user-controlled legacy Markdown", () => {
    expect(escapeTelegramMarkdown("*BTC_[x](y)`\\")).toBe(
      "\\*BTC\\_\\[x\\]\\(y\\)\\`\\\\",
    );
  });
});
