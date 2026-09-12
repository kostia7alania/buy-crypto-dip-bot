<script setup lang="ts">
const features = [
  {
    title: "Native Bybit spot",
    body: "Prices come from Bybit's public API. Public snapshots are useful dry-run inputs but do not prove the data or execution lifecycle of a live strategy.",
  },
  {
    title: "It holds no keys at all",
    body: "There is no code in the bot that can place an order or store an exchange key. Nothing to leak, nothing to misuse.",
  },
  {
    title: "Dry-run, start to finish",
    body: "Simulate DCA on real Bybit prices. Simulated orders are all the bot places today; live trading is still being built.",
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
    title: "Judge it on the record",
    body: "Inspect simulated results and benchmark limitations for as long as useful. Private exchange access, Demo orders and live trading are not available.",
  },
];
const faqs = [
  {
    q: "Does it work with Bybit spot?",
    a: "Yes, for reviewed public market-data symbols. Dip detection reads Bybit's public API and orders are simulated; private credentials, Demo submission and live orders are not built.",
  },
  {
    q: "What API permissions do I need?",
    a: "None. The current build has no legitimate reason to receive any exchange key. Withdrawal, transfer, margin and derivatives permissions are prohibited; a future credential model would require a separate reviewed release.",
  },
  {
    q: "Can I test without live keys?",
    a: "That is the only shipped mode. It needs no API key and cannot move exchange funds, but simulation still carries model, data, software and interpretation risk.",
  },
  {
    q: "Which pairs are supported?",
    a: "BTCUSDT, ETHUSDT and SOLUSDT are in the default reviewed allowlist. Arbitrary user-entered symbols are not a supported capability claim.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Bybit DCA Bot"
    title="Bybit DCA Bot via Telegram — Dry-Run Spot Signals"
    description="A Telegram-capable dry-run DCA bot for reviewed Bybit spot symbols: public-price dip detection, simulated orders and delivery evidence. No API keys or live orders."
    headline="The Telegram DCA bot built for Bybit spot"
    subheadline="Dollar-cost average into dips on Bybit prices with hard spend limits and a dry-run mode that needs no API keys at all."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
