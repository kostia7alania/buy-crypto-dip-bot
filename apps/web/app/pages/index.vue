<script setup lang="ts">
const features = [
  {
    title: "Dry-run by default",
    body: "Every strategy runs as a realistic simulation first. Watch it buy dips and track profit and loss before a single cent is at risk.",
  },
  {
    title: "RiskGuard on every order",
    body: "Daily and weekly spend caps, an allowlist of symbols, and a cooldown between buys. No order is created unless it passes.",
  },
  {
    title: "Telegram-native",
    body: "Configure strategies, get pending-buy alerts with a live countdown, cancel or execute — all from a chat you already use.",
  },
  {
    title: "Full audit trail",
    body: "Every signal, approval, rejection and simulated order is logged and visible on a real-time dashboard.",
  },
];

const steps = [
  {
    title: "Detect the dip",
    body: "The engine polls live Bybit spot prices and measures the drop from the 24-hour high against your threshold.",
  },
  {
    title: "Pass RiskGuard",
    body: "A qualifying signal is checked against your spend limits, allowlist and cooldown before anything happens.",
  },
  {
    title: "Simulate the buy",
    body: "An approved signal creates a dry-run order after a grace period during which you can cancel from Telegram.",
  },
  {
    title: "Track performance",
    body: "See simulated purchases, average buy price and unrealized PnL on the dashboard and via /pnl in the bot.",
  },
];

const faqs = [
  {
    q: "Is this a real trading bot or a simulation?",
    a: "Both. It runs dry-run (paper) by default so you can trust it first. Live spot trading is opt-in, capped, and always guarded by RiskGuard.",
  },
  {
    q: "Which exchange does it use?",
    a: "Bybit spot. Prices come from Bybit's public API; live trading uses your own spot-only, no-withdrawal API keys.",
  },
  {
    q: "Does it trade memecoins or use leverage?",
    a: "No. By design there are no futures, leverage, martingale or memecoin trading. It is a risk-first spot dip-buying tool.",
  },
  {
    q: "How much does it cost?",
    a: "The bot is free and self-hostable. You only pay normal exchange trading fees if you enable live trading.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="AI Crypto DCA Bot for Buying the Dip"
    description="Automate risk-first crypto dip buying on Bybit spot: dry-run mode by default, strict spend limits, full audit logs and Telegram alerts."
    headline="Buy the dip safely, prove it works, then trade"
    subheadline="A risk-first, Telegram-native DCA bot that simulates every dip buy first — so you build trust before you risk a cent."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
