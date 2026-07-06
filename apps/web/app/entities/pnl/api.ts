import type { PnlReport } from "./types.js";

export const fetchPnl = () => $fetch<PnlReport>("/api/pnl");
