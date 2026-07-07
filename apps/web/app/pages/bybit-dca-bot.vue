<script setup lang="ts">
const features = [
  {
    title: "Native Bybit spot",
    body: "Prices come straight from Bybit's public API; live trading uses your own spot-only Bybit keys.",
  },
  {
    title: "No withdrawal access",
    body: "Connect with keys that can trade but never withdraw. The bot can't move your funds off the exchange.",
  },
  {
    title: "Dry-run first",
    body: "Simulate DCA on real Bybit prices before you enable a single live order.",
  },
  {
    title: "Telegram control",
    body: "Manage strategies, get alerts and check PnL from Telegram — no separate app to install.",
  },
];
const steps = [
  {
    title: "Point it at Bybit",
    body: "The bot reads live BTCUSDT, ETHUSDT and SOLUSDT prices from Bybit spot out of the box.",
  },
  {
    title: "Set your rules",
    body: "Choose dip thresholds, buy amounts and spend limits per symbol.",
  },
  {
    title: "Guarded orders",
    body: "RiskGuard enforces limits and cooldowns; dry-run orders come with a Telegram cancel window.",
  },
  {
    title: "Go live when ready",
    body: "Add spot-only, no-withdrawal keys to enable capped live trading.",
  },
];
const faqs = [
  {
    q: "Does it work with Bybit spot?",
    a: "Yes. Bybit spot is the first and default exchange. Market data uses Bybit's public API and live trading uses your Bybit spot keys.",
  },
  {
    q: "What API permissions do I need?",
    a: "Spot trading only, with withdrawals disabled. The bot never needs — and should never be given — withdrawal permission.",
  },
  {
    q: "Can I test without live keys?",
    a: "Absolutely. Dry-run mode uses public Bybit prices and needs no API keys, so you can evaluate it risk-free.",
  },
  {
    q: "Which pairs are supported?",
    a: "BTCUSDT, ETHUSDT and SOLUSDT are seeded by default, and you can add any valid Bybit spot pair from Telegram.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Bybit DCA Bot"
    title="Bybit DCA Bot"
    description="A risk-first DCA bot for Bybit spot: dip detection on live Bybit prices, spot-only no-withdrawal keys, dry-run mode and Telegram alerts."
    headline="A DCA bot built for Bybit spot"
    subheadline="Dollar-cost average into dips on Bybit with spot-only keys, hard spend limits and a dry-run mode that needs no API keys at all."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
