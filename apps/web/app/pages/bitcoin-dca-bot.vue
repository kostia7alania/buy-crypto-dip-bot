<script setup lang="ts">
const features = [
  {
    title: "Built for Bitcoin",
    body: "Accumulate BTC on dips with a rule you control — threshold, size and limits — instead of guessing the bottom.",
  },
  {
    title: "Spot only, no leverage",
    body: "Just spot Bitcoin. No futures, no liquidations, no margin calls — accumulation the boring, safe way.",
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
    a: "No. In live mode it trades on your own Bybit account with spot-only, no-withdrawal keys. It never custodies funds.",
  },
  {
    q: "Can it use leverage on Bitcoin?",
    a: "No. It is spot-only by design — there is no margin, futures or liquidation risk.",
  },
  {
    q: "What if Bitcoin keeps falling?",
    a: "Daily and weekly spend limits cap how much it deploys, so a prolonged downtrend can't drain your budget.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Bitcoin DCA Bot"
    title="Bitcoin DCA Bot"
    description="A risk-first Bitcoin DCA bot that accumulates BTC on dips on Bybit spot, with dry-run mode, spend caps and Telegram alerts. No leverage, ever."
    headline="Stack Bitcoin on the dips, safely"
    subheadline="Automate BTC dollar-cost averaging with strict limits and a simulation-first workflow — spot only, no leverage, no drama."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
