<script setup lang="ts">
const features = [
  {
    title: "Built for Bitcoin",
    body: "Simulate BTC dip accumulation with a rule you control: threshold, size and limits instead of guessing the bottom.",
  },
  {
    title: "Spot market data, no leverage",
    body: "The current engine reads public BTCUSDT spot data and models buys only. It has no futures, margin or live-order adapter.",
  },
  {
    title: "Simulated first",
    body: "See how your BTC DCA would have performed on live prices before committing a single satoshi.",
  },
  {
    title: "Alerts you'll actually read",
    body: "Telegram pings for every pending buy with a countdown, plus a /pnl command for your position.",
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
    body: "Spend caps and cooldown gate every order; a dry-run buy is scheduled with a cancel window.",
  },
  {
    title: "Watch it stack",
    body: "Track average cost basis and unrealized PnL on your BTC position.",
  },
];
const faqs = [
  {
    q: "Is this a good way to accumulate Bitcoin?",
    a: "Dollar-cost averaging into dips is a common long-term accumulation approach. This bot automates it with spend caps and a dry-run mode to reduce risk.",
  },
  {
    q: "Does it hold my Bitcoin?",
    a: "No. The current release does not connect to a private Bybit account, execute orders or custody Bitcoin. Every recorded buy is simulated.",
  },
  {
    q: "Can it use leverage on Bitcoin?",
    a: "No. It models a spot-only accumulation strategy and has no margin, futures or live execution path.",
  },
  {
    q: "What if Bitcoin keeps falling?",
    a: "Daily and weekly limits cap simulated allocation. They do not stop Bitcoin from falling or turn the strategy into a profit guarantee.",
  },
  {
    q: "Bitcoin DCA vs lump sum — which is better?",
    a: "Lump sum wins in steadily rising markets; DCA wins psychologically and in volatile or falling markets by averaging your entry. Dip-triggered DCA aims to improve on calendar DCA by buying only when price is already down — and our dashboard benchmarks all three honestly.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Bitcoin DCA Bot"
    title="Bitcoin DCA Bot - Simulate BTC Dip Buys for Free"
    description="A risk-first Bitcoin DCA simulator: model BTC dip buys on public Bybit spot prices with spend caps, benchmarks and Telegram alerts. No leverage or live orders."
    headline="Test a rule for stacking Bitcoin on dips"
    subheadline="Simulate BTC dollar-cost averaging with strict limits and current spot data before putting exchange funds at risk."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
