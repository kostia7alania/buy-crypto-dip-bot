export interface BenchmarkLeg {
  qty: number;
  valueUsdt: number;
  pnlPercent: number;
}

export interface PerformancePosition {
  symbol: string;
  orders: number;
  spentUsdt: number;
  currentPrice: number;
  actual: BenchmarkLeg;
  calendarDca: BenchmarkLeg;
  hold: BenchmarkLeg;
}

export interface PerformanceReport {
  positions: PerformancePosition[];
}
