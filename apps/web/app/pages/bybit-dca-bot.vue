<script setup lang="ts">
const features = [
  {
    title: "Native Bybit spot",
    body: "Prices come from Bybit's public spot API; the current release does not connect private trading keys.",
  },
  {
    title: "No custody or private keys",
    body: "The bot cannot move funds or place exchange orders because it reads public market data only.",
  },
  {
    title: "Dry-run first",
    body: "Simulate DCA against observed Bybit prices without enabling any live order path.",
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
    title: "Review the evidence",
    body: "Use simulated PnL, benchmarks and audit history to evaluate the rules. Live trading is outside this release.",
  },
];
const faqs = [
  {
    q: "Does it work with Bybit spot?",
    a: "Yes for public spot market data and dry-run simulation. The released product does not submit orders to Bybit.",
  },
  {
    q: "What API permissions do I need?",
    a: "None. Do not provide an exchange key to the current release; it uses Bybit's public market-data endpoints.",
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
    title="Bybit DCA Bot via Telegram — Spot Dip Buying, Free"
    description="A Telegram-native Bybit DCA simulator: dip detection on public spot prices, dry-run orders, spend limits and alerts without private exchange keys."
    headline="The Telegram DCA bot built for Bybit spot"
    subheadline="Simulate dollar-cost averaging into Bybit dips with hard spend limits, audit history and no private API keys."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
