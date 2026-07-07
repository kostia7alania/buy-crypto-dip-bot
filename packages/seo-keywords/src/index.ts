// Landing routes, one per target query cluster. Sourced from live Google
// autocomplete research (2026-07): each page owns a primary keyword and its
// long-tail variants — see docs/14_PRODUCT_STRATEGY.md for the keyword map.
export const seoRoutes = [
  "/",
  "/crypto-dca-bot",
  "/buy-crypto-dip-bot",
  "/bitcoin-dca-bot",
  "/crypto-dip-buying-bot",
  "/bybit-dca-bot",
  "/flash-crash-crypto-bot",
  "/crypto-risk-management-bot",
  "/dca-bot-vs-grid-bot",
  "/crypto-paper-trading-bot",
] as const;
