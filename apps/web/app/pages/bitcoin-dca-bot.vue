<script setup lang="ts">
const features = [
  {
    title: "Built for Bitcoin",
    body: "Accumulate BTC on dips with a rule you control — threshold, size and limits — instead of guessing the bottom.",
  },
  {
    title: "Spot only, no leverage",
    body: "The product policy permits spot-style dry-run decisions only. Futures, leverage, margin and liquidation-prone products are prohibited.",
  },
  {
    title: "Simulated first",
    body: "See how your BTC DCA would have performed on live prices before committing a single satoshi.",
  },
  {
    title: "Alerts you'll actually read",
    body: "After private /start enables delivery, eligible pending-order messages are queued with delivery evidence. Countdown edits are cosmetic; /pnl reports simulated valuation.",
  },
];
const steps = [
  {
    title: "Set your BTC rule",
    body: "Choose the dip threshold and USDT amount per buy for BTCUSDT.",
  },
  {
    title: "Dip detection",
    body: "The bot watches Bitcoin's price against its 24h high on Bybit spot.",
  },
  {
    title: "Risk-checked buy",
    body: "Spend caps and cooldown gate each proposed reservation; an approved dry-run buy receives a database execution time.",
  },
  {
    title: "Watch it stack",
    body: "Track average cost basis and unrealized PnL on your BTC position.",
  },
];
const faqs = [
  {
    q: "Is this a good way to accumulate Bitcoin?",
    a: "It is one strategy hypothesis, not a recommendation. The dry-run and configured caps help inspect behavior, but they do not establish suitability or future performance.",
  },
  {
    q: "Does it hold my Bitcoin?",
    a: "No. The shipped build simulates orders and has no private exchange-key path. Do not provide it withdrawal, transfer, margin, derivatives or any other exchange credential.",
  },
  {
    q: "Can it use leverage on Bitcoin?",
    a: "No. It is spot-only by design — there is no margin, futures or liquidation risk.",
  },
  {
    q: "What if Bitcoin keeps falling?",
    a: "Daily and weekly limits are checked before simulated reservations. They bound configured dry-run spend when the controls operate correctly; they do not remove market, configuration or software risk.",
  },
  {
    q: "Bitcoin DCA vs lump sum — which is better?",
    a: "Outcomes depend on the window, cash-flow timing, fees and market path. The dashboard compares simplified methods over a stated data window; it is not evidence that one method generally wins.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Bitcoin DCA Bot"
    title="Bitcoin DCA Bot — Simulate BTC Dip Rules"
    description="A dry-run Bitcoin DCA bot for simulating BTCUSDT dip rules using public Bybit prices, configured spend caps and optional Telegram delivery. No leverage or live orders."
    headline="Inspect a Bitcoin dip rule before trusting it"
    subheadline="Automate BTC dollar-cost averaging with strict limits and a simulation-first workflow — spot only, no leverage, no drama."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
