<script setup lang="ts">
const features = [
  {
    title: "Real prices, fake money",
    body: "Dry-run mode evaluates public Bybit spot prices and records simulated orders without touching an exchange account.",
  },
  {
    title: "No API keys needed",
    body: "The current release uses public market data only and never asks for private exchange credentials.",
  },
  {
    title: "Honest scoreboard",
    body: "Simulated PnL plus a benchmark comparison against calendar DCA and buy-and-hold — so you know if the strategy actually earns its keep.",
  },
  {
    title: "One auditable dry-run engine",
    body: "Strategy evaluation, RiskGuard decisions, simulated orders and audit history run through the same released dry-run path.",
  },
];
const steps = [
  {
    title: "Start in simulation",
    body: "Dry-run is the default mode — add strategies and let them paper-trade dips 24/7.",
  },
  {
    title: "Watch it work",
    body: "Telegram alerts announce every simulated buy; the dashboard tracks orders, PnL and audit logs in real time.",
  },
  {
    title: "Judge with benchmarks",
    body: "Compare dip-buying against naive baselines over the same window and budget.",
  },
  {
    title: "Keep the evidence",
    body: "Use the order ledger, PnL and benchmarks to decide whether the strategy deserves more research. Live execution is not included.",
  },
];
const faqs = [
  {
    q: "What is a crypto paper trading bot?",
    a: "A bot that executes a trading strategy with simulated money against real market prices. It shows how the strategy would have performed without risking funds.",
  },
  {
    q: "How long should I paper trade?",
    a: "There is no universal safe duration. Collect enough observations across different market conditions and judge the result against fees, slippage and simple benchmarks.",
  },
  {
    q: "Is the simulation realistic?",
    a: "It uses sampled public Bybit spot prices. It does not reproduce fills, latency, liquidity, slippage, fees or exchange outages, so results are evidence for research rather than a profit promise.",
  },
  {
    q: "Does paper trading cost anything?",
    a: "The software needs no exchange account or private API key. Hosting and provider limits still depend on where the project is deployed.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Paper Trading Bot"
    title="Crypto Paper Trading Bot"
    description="A free crypto paper trading bot: dry-run a dip-buying DCA strategy on live Bybit prices with simulated funds, PnL tracking and benchmark comparison."
    headline="Paper trade the dip strategy before risking a cent"
    subheadline="Dry-run is the only released mode: public market prices, simulated money, transparent PnL and benchmark comparisons."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
