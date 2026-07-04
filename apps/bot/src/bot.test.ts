import { describe, expect, it } from "vitest";
import { createBot, START_MESSAGE, STATUS_MESSAGE } from "./bot.js";

describe("bot skeleton", () => {
  it("keeps public commands in dry-run safe mode", () => {
    expect(START_MESSAGE).toContain("DRY_RUN");
    expect(STATUS_MESSAGE).toContain("Live trading: disabled");
  });

  it("creates a grammY bot without starting network polling", () => {
    expect(createBot("test-token")).toHaveProperty("command");
  });
});
