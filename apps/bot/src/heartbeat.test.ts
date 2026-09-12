import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchBotHeartbeatApi = vi.fn();

vi.mock("./runtime-config.js", () => ({ fetchBotHeartbeatApi }));

const { publishBotHeartbeat } = await import("./heartbeat.js");

describe("bot readiness heartbeat", () => {
  beforeEach(() => {
    fetchBotHeartbeatApi.mockReset();
  });

  it("publishes an authenticated-service request with a safe correlation id", async () => {
    fetchBotHeartbeatApi.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(publishBotHeartbeat()).resolves.toBe(true);
    expect(fetchBotHeartbeatApi).toHaveBeenCalledOnce();
    const [init] = fetchBotHeartbeatApi.mock.calls[0] as [RequestInit];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-request-id")).toMatch(
      /^[A-Za-z0-9_-]{8,80}$/,
    );
  });

  it("reports a rejected heartbeat without throwing into polling", async () => {
    fetchBotHeartbeatApi.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(publishBotHeartbeat()).resolves.toBe(false);
  });
});
