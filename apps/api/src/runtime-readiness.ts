export type ReadinessState = "starting" | "ready" | "failed";

export interface RuntimeReadinessSnapshot {
  state: ReadinessState;
  database: ReadinessState;
  runner: ReadinessState;
  bot: ReadinessState | "stale" | "not_required";
  botLastSeenAt: string | null;
  schemaVersion: string;
  checkedAt: string;
}

const schemaVersion = "0014_bouncy_zuras";
export const BOT_HEARTBEAT_STALE_MS = 90_000;
let database: ReadinessState = "starting";
let runner: ReadinessState = "starting";
let botRequired = false;
let botLastSeenAt: Date | null = null;

export const beginStartup = (requiresBot = false) => {
  database = "starting";
  runner = "starting";
  botRequired = requiresBot;
  botLastSeenAt = null;
};

export const markDatabaseReady = () => {
  database = "ready";
};

export const markRunnerReady = () => {
  runner = "ready";
};

export const markBotHeartbeat = (at: Date = new Date()) => {
  botLastSeenAt = at;
};

export const markStartupFailed = () => {
  if (database !== "ready") database = "failed";
  if (runner !== "ready") runner = "failed";
};

export const getRuntimeReadiness = (
  now: Date = new Date(),
): RuntimeReadinessSnapshot => {
  const bot = !botRequired
    ? "not_required"
    : !botLastSeenAt
      ? "starting"
      : now.getTime() - botLastSeenAt.getTime() <= BOT_HEARTBEAT_STALE_MS
        ? "ready"
        : "stale";
  return {
    state:
      database === "failed" || runner === "failed" || bot === "stale"
        ? "failed"
        : database === "ready" &&
            runner === "ready" &&
            (bot === "ready" || bot === "not_required")
          ? "ready"
          : "starting",
    database,
    runner,
    bot,
    botLastSeenAt: botLastSeenAt?.toISOString() ?? null,
    schemaVersion,
    checkedAt: now.toISOString(),
  };
};
