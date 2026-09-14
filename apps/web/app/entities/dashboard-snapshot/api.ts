import type { DashboardSnapshot } from "./types.js";

export const fetchDashboardSnapshot = (signal?: AbortSignal) =>
  $fetch<DashboardSnapshot>("/api/dashboard/snapshot", { signal });
