export interface PnlPosition {
  symbol: string;
  orders: number;
  spentUsdt: number;
  baseQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValueUsdt: number;
  pnlUsdt: number;
  pnlPercent: number;
}

export interface PnlTotals {
  spentUsdt: number;
  currentValueUsdt: number;
  pnlUsdt: number;
  pnlPercent: number;
}

export interface PnlReport {
  positions: PnlPosition[];
  totals: PnlTotals | null;
}
