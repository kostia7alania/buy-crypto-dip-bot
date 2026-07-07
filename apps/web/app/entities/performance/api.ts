import type { PerformanceReport } from "./types.js";

export const fetchPerformance = () =>
  $fetch<PerformanceReport>("/api/performance");
