import type { RunnerConnection, RunnerStatusResponse } from "../types.js";

const STALE_AFTER_TICKS = 3;

export const getRunnerConnection = (
  status: RunnerStatusResponse | null | undefined,
): RunnerConnection => {
  if (status?.apiReachable !== true) {
    return { state: "offline", label: "API Offline" };
  }

  const observedAtMs = Date.parse(status.observedAt ?? "");
  const lastTickAtMs = Date.parse(status.runner?.lastTickAt ?? "");
  const tickIntervalMs = status.runner?.tickIntervalMs ?? 0;
  const timestampsAreValid =
    Number.isFinite(observedAtMs) && Number.isFinite(lastTickAtMs);

  if (
    !timestampsAreValid ||
    tickIntervalMs <= 0 ||
    observedAtMs - lastTickAtMs > tickIntervalMs * STALE_AFTER_TICKS
  ) {
    return { state: "stale", label: "Runner Stale" };
  }

  return { state: "live", label: "Live Connection Active" };
};
