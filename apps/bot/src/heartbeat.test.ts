import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchBotHeartbeatApi = vi.fn();

vi.mock("./runtime-config.js", () => ({ fetchBotHeartbeatApi }));

const {
  BOT_HEARTBEAT_INTERVAL_MS,
  BOT_HEARTBEAT_TIMEOUT_MS,
  publishBotHeartbeat,
  startBotHeartbeat,
} = await import("./heartbeat.js");

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

  it("bounds stalled heartbeat IO and stops without leaving interval work", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const signals: AbortSignal[] = [];
    fetchBotHeartbeatApi.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
    );
    const stop = startBotHeartbeat();
    expect(fetchBotHeartbeatApi).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(BOT_HEARTBEAT_TIMEOUT_MS);
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(
      BOT_HEARTBEAT_INTERVAL_MS - BOT_HEARTBEAT_TIMEOUT_MS,
    );
    expect(fetchBotHeartbeatApi).toHaveBeenCalledTimes(2);
    const stopped = stop();
    expect(stop()).toBe(stopped);
    await stopped;
    expect(signals[1]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(BOT_HEARTBEAT_INTERVAL_MS);
    expect(fetchBotHeartbeatApi).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
