import { describe, expect, it } from "vitest";
import {
  BOT_HEARTBEAT_STALE_MS,
  beginStartup,
  getRuntimeReadiness,
  markBotHeartbeat,
  markDatabaseReady,
  markRunnerReady,
} from "./runtime-readiness.js";

describe("dependency-aware readiness", () => {
  it("distinguishes a fresh bot from a stale bot", () => {
    const heartbeatAt = new Date("2026-08-02T20:00:00.000Z");
    beginStartup(true);
    markDatabaseReady();
    markRunnerReady();
    markBotHeartbeat(heartbeatAt);

    expect(getRuntimeReadiness(heartbeatAt)).toMatchObject({
      state: "ready",
      database: "ready",
      runner: "ready",
      bot: "ready",
      botLastSeenAt: heartbeatAt.toISOString(),
    });

    const staleAt = new Date(
      heartbeatAt.getTime() + BOT_HEARTBEAT_STALE_MS + 1,
    );
    expect(getRuntimeReadiness(staleAt)).toMatchObject({
      state: "failed",
      bot: "stale",
      botLastSeenAt: heartbeatAt.toISOString(),
    });
  });
});
