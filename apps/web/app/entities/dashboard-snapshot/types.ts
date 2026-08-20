import type { AuditLog } from "../audit/index.js";
import type { Order } from "../order/index.js";
import type { PerformanceReport } from "../performance/index.js";
import type { PnlReport } from "../pnl/index.js";
import type { RunnerStatusResponse } from "../runner/index.js";
import type { Strategy } from "../strategy/index.js";

export interface DashboardRiskStatus extends RunnerStatusResponse {
  mode: string;
  liveTradingEnabled: boolean;
  orderLikeActionsRequireApproval: boolean;
}

export interface DashboardOrder extends Order {
  status: string;
}

export interface DashboardSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  risk: DashboardRiskStatus;
  strategies: Strategy[];
  orders: DashboardOrder[];
  audit: AuditLog[];
  pnl: PnlReport;
  performance: PerformanceReport;
}
