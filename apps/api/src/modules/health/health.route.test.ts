import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { beginStartup } from "../../runtime-readiness.js";

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

  it("keeps liveness separate from startup readiness", async () => {
    beginStartup();
    const res = await createApp().request("/health/ready");

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      state: "starting",
      bot: "not_required",
      schemaVersion: "0014_bouncy_zuras",
    });
  });

  it("keeps an uncredentialed local bot heartbeat available for development", async () => {
    const response = await createApp({ runtime: "local" }).request(
      "/health/bot-heartbeat",
      { method: "POST" },
    );
    expect(response.status).toBe(204);
  });

  it("protects bot readiness writes with service authentication", async () => {
    const botHeartbeatSecret =
      "bot-heartbeat-secret-for-a-non-local-deployment-1234567890";
    const app = createApp({
      runtime: "non-local",
      apiKey: "service-key",
      botHeartbeatSecret,
    });
    expect(
      (await app.request("/health/bot-heartbeat", { method: "POST" })).status,
    ).toBe(401);
    expect(
      (
        await app.request("/health/bot-heartbeat", {
          method: "POST",
          headers: { "x-bot-heartbeat-secret": botHeartbeatSecret },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request("/health/bot-heartbeat", {
          method: "POST",
          headers: { "x-api-key": "service-key" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request("/health/bot-heartbeat", {
          method: "POST",
          headers: {
            "x-api-key": "service-key",
            "x-bot-heartbeat-secret":
              "wrong-bot-secret-with-safe-length-1234567890",
          },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request("/health/bot-heartbeat", {
          method: "POST",
          headers: {
            "x-api-key": "service-key",
            "x-bot-heartbeat-secret": botHeartbeatSecret,
          },
        })
      ).status,
    ).toBe(204);
  });
});
