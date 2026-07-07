<script setup lang="ts">
const features = [
  {
    title: "Real prices, fake money",
    body: "Dry-run mode trades live Bybit spot prices with simulated funds — the strategy behaves exactly as it would with real capital.",
  },
  {
    title: "No API keys needed",
    body: "Paper trading uses public market data only. You don't connect an exchange account until you decide to go live.",
  },
  {
    title: "Honest scoreboard",
    body: "Simulated PnL plus a benchmark comparison against calendar DCA and buy-and-hold — so you know if the strategy actually earns its keep.",
  },
  {
    title: "Same engine as live",
    body: "The simulation runs the identical strategy and RiskGuard code paths that live trading uses. What you test is what you get.",
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
    title: "Go live only when convinced",
    body: "After weeks of green simulation, enable capped live trading with spot-only keys — or don't. No pressure.",
  },
];
const faqs = [
  {
    q: "What is a crypto paper trading bot?",
    a: "A bot that executes a trading strategy with simulated money against real market prices. It shows how the strategy would have performed without risking funds.",
  },
  {
    q: "How long should I paper trade before going live?",
    a: "Common guidance is 2–4 weeks minimum, then starting live with only 10–25% of intended capital. Our dry-run mode is built for exactly this workflow.",
  },
  {
    q: "Is the simulation realistic?",
    a: "It uses live Bybit spot prices and the same strategy and risk-check code as live mode. Slippage and fees are the main real-world differences.",
  },
  {
    q: "Does paper trading cost anything?",
    a: "No. Dry-run mode is free, needs no exchange account, and runs 24/7 on our engine.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Paper Trading Bot"
    title="Crypto Paper Trading Bot"
    description="A free crypto paper trading bot: dry-run a dip-buying DCA strategy on live Bybit prices with simulated funds, PnL tracking and benchmark comparison."
    headline="Paper trade the dip strategy before risking a cent"
    subheadline="Dry-run is our default mode: live prices, simulated money, honest PnL and benchmarks. Go live only when the numbers convince you."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
