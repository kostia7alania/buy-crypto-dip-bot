<script setup lang="ts">
const features = [
  {
    title: "Real prices, fake money",
    body: "Dry-run evaluates public Bybit spot observations with simulated funds. It cannot prove exchange fills, fees, slippage, liquidity, latency or reconciliation.",
  },
  {
    title: "No API keys needed",
    body: "Paper trading uses public market data only. There is no exchange account to connect — the bot has no key storage and no order-placing code.",
  },
  {
    title: "Honest scoreboard",
    body: "Simulated PnL plus a benchmark comparison against calendar DCA and buy-and-hold — so you know if the strategy actually earns its keep.",
  },
  {
    title: "Evidence for the shipped dry-run path",
    body: "The simulation exercises current strategy and RiskGuard logic. Any future exchange path would require separate safety, credential, order-lifecycle and reconciliation proof.",
  },
];
const steps = [
  {
    title: "Start in simulation",
    body: "Dry-run is the default mode — add strategies and let them paper-trade dips 24/7.",
  },
  {
    title: "Watch it work",
    body: "Eligible private-chat alerts are queued with delivery evidence; the dashboard shows simulated orders, valuation and audit records.",
  },
  {
    title: "Judge with benchmarks",
    body: "Compare dip-buying against naive baselines over the same window and budget.",
  },
  {
    title: "Judge it on weeks of evidence",
    body: "Watch the simulated result against honest benchmarks for as long as you want. Capped live trading with spot-only keys is the planned next step, not a button that exists today.",
  },
];
const faqs = [
  {
    q: "What is a crypto paper trading bot?",
    a: "A bot that evaluates a strategy with simulated funds against observed public prices. It does not risk exchange funds, but its result is still incomplete evidence rather than a prediction of live performance.",
  },
  {
    q: "How long should I paper trade before trusting a strategy?",
    a: "There is no universal safe duration. Use multiple market regimes and inspect rejection, stale-data and benchmark evidence. This product does not currently provide a path to live trading.",
  },
  {
    q: "Is the simulation realistic?",
    a: "It uses public Bybit spot observations and current strategy/risk code. It does not model or prove fills, fees, slippage, liquidity, latency, outages or reconciliation.",
  },
  {
    q: "Does paper trading cost anything?",
    a: "Dry-run creates no exchange fee because it places no exchange order. Self-hosting still has infrastructure and operating costs, and no hosted tariff is offered.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Paper Trading Bot"
    title="Crypto Paper Trading Bot"
    description="A self-hosted crypto paper-trading bot: evaluate a dip-buying DCA strategy on public Bybit prices with simulated funds, valuation and benchmark views."
    headline="Paper trade the dip strategy before risking a cent"
    subheadline="Dry-run is the only mode: public price observations, simulated money and explicit limitations. No API keys and no exchange orders."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
