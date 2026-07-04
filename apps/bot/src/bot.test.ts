import { describe, expect, it } from "vitest";
import { createBot } from "./bot.js";

describe("bot skeleton", () => {
  it("creates a grammY bot without starting network polling", () => {
    const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    expect(bot).toHaveProperty("command");
    expect(typeof bot.command).toBe("function");
  });
});
