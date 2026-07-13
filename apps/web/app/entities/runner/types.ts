export interface RunnerStatusResponse {
  apiReachable?: boolean;
  observedAt?: string;
  runner?: {
    lastTickAt: string | null;
    tickIntervalMs: number;
  };
}

export interface RunnerConnection {
  state: "offline" | "stale" | "live";
  label: string;
}
