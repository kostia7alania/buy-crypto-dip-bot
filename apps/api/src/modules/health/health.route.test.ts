import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";

vi.mock("../../db.js", () => ({
  getDb: () => ({ execute: async () => [] }),
}));

describe("health and version routes", () => {
  it("returns health status", async () => {
    const res = await createApp().request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: "api" });
  });

  it("returns service version metadata", async () => {
    const res = await createApp().request("/version");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "buy-crypto-dip-bot" });
  });
});
