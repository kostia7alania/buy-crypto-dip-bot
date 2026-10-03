import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beginStartup, getRuntimeReadiness } from "./runtime-readiness.js";
import { API_SHUTDOWN_TIMEOUT_MS, createApiShutdown } from "./shutdown.js";

const setup = () => {
  const http = Promise.withResolvers<void>();
  const runner = Promise.withResolvers<void>();
  const database = Promise.withResolvers<void>();
  const closeHttp = vi.fn(() => http.promise);
  const stopRunner = vi.fn(() => runner.promise);
  const closeDatabase = vi.fn(() => database.promise);
  const exit = vi.fn();
  const shutdown = createApiShutdown({
    closeHttp,
    stopRunner,
    closeDatabase,
    exit,
  });
  return {
    http,
    runner,
    database,
    closeHttp,
    stopRunner,
    closeDatabase,
    exit,
    shutdown,
  };
};

describe("bounded API shutdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    beginStartup();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts both drains immediately and closes the API pool once, after both finish", async () => {
    const state = setup();
    const stopped = state.shutdown.stop();
    expect(state.shutdown.stop()).toBe(stopped);
    expect(state.closeHttp).toHaveBeenCalledTimes(1);
    expect(state.stopRunner).toHaveBeenCalledTimes(1);
    expect(getRuntimeReadiness().state).toBe("stopping");

    const lateRequest = vi.fn(() => new Response("unexpected"));
    const response = await state.shutdown.handleRequest(lateRequest);
    expect(response.status).toBe(503);
    expect(response.headers.get("connection")).toBe("close");
    expect(lateRequest).not.toHaveBeenCalled();

    state.http.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.closeDatabase).not.toHaveBeenCalled();
    state.runner.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.closeDatabase).toHaveBeenCalledTimes(1);
    expect(state.exit).not.toHaveBeenCalled();

    state.database.resolve();
    await stopped;
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(state.shutdown.stop()).toBe(stopped);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for a disconnected client's handler after HTTP and runner have drained", async () => {
    const state = setup();
    const handler = Promise.withResolvers<Response>();
    const request = state.shutdown.handleRequest(() => handler.promise);
    const stopped = state.shutdown.stop();
    state.http.resolve();
    state.runner.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.closeDatabase).not.toHaveBeenCalled();

    handler.resolve(new Response("completed"));
    await request;
    await vi.advanceTimersByTimeAsync(0);
    expect(state.closeDatabase).toHaveBeenCalledTimes(1);
    state.database.resolve();
    await stopped;
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("forces an observable nonzero exit for stalled runner IO without extending repeated signals", async () => {
    const state = setup();
    const stopped = state.shutdown.stop();
    state.http.resolve();
    await vi.advanceTimersByTimeAsync(API_SHUTDOWN_TIMEOUT_MS - 1);
    expect(state.exit).not.toHaveBeenCalled();
    expect(state.shutdown.stop()).toBe(stopped);
    await vi.advanceTimersByTimeAsync(1);
    await stopped;
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(state.closeDatabase).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"event":"API_SHUTDOWN_TIMED_OUT"'),
    );

    // A late completion cannot resume teardown or turn the timeout into success.
    state.runner.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.closeDatabase).not.toHaveBeenCalled();
    expect(state.exit).toHaveBeenCalledTimes(1);
  });

  it("includes API pool closure in the same total deadline", async () => {
    const state = setup();
    const stopped = state.shutdown.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    state.http.resolve();
    state.runner.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.closeDatabase).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(API_SHUTDOWN_TIMEOUT_MS - 20_000);
    await stopped;
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1);

    state.database.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.exit).toHaveBeenCalledTimes(1);
  });

  it("does not close the API pool after a failed drain or expose the raw error", async () => {
    const state = setup();
    const stopped = state.shutdown.stop();
    state.runner.reject(new Error("postgresql://app:secret@db/private"));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.exit).not.toHaveBeenCalled();
    state.http.resolve();
    await stopped;
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(state.closeDatabase).not.toHaveBeenCalled();
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).toContain("API_SHUTDOWN_FAILED");
    expect(logs).not.toContain("secret");
    expect(vi.getTimerCount()).toBe(0);
  });
});
