import { describe, expect, it } from "vitest";
import { getRunnerConnection } from "./get-runner-connection.js";

describe("getRunnerConnection", () => {
  it("reports an unreachable API as offline", () => {
    expect(getRunnerConnection({ apiReachable: false })).toEqual({
      state: "offline",
      label: "API Offline",
    });
  });

  it("uses the serialized observation time for a live runner", () => {
    expect(
      getRunnerConnection({
        apiReachable: true,
        observedAt: "2026-07-13T12:01:00.000Z",
        runner: {
          lastTickAt: "2026-07-13T12:00:30.000Z",
          tickIntervalMs: 30_000,
        },
      }),
    ).toEqual({ state: "live", label: "Live Connection Active" });
  });

  it("reports a runner older than three ticks as stale", () => {
    expect(
      getRunnerConnection({
        apiReachable: true,
        observedAt: "2026-07-13T12:02:01.000Z",
        runner: {
          lastTickAt: "2026-07-13T12:00:30.000Z",
          tickIntervalMs: 30_000,
        },
      }),
    ).toEqual({ state: "stale", label: "Runner Stale" });
  });
});
