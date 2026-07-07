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
  {
    title: "Benchmarked honestly",
    body: "The dashboard compares dip-buying against dumb calendar DCA and buy-and-hold over the same capital — wins and losses shown as they are.",
  },
  {
    title: "Free and self-hostable",
    body: "Open source, no subscription, no custody. Run it yourself or use the hosted dashboard — you only ever pay exchange fees.",
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
  {
    q: "How do I know the strategy actually works?",
    a: "You watch it prove itself: the dashboard benchmarks your dip-buying against calendar DCA and buy-and-hold with the same capital over the same window. If it lags, you'll see that too — honesty is the feature.",
  },
  {
    q: "Is it safe to connect my exchange account?",
    a: "You don't have to — paper trading needs no keys at all. Going live uses spot-only Bybit API keys with withdrawals disabled, so the bot can never move funds off the exchange.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="Buy Crypto Dip Bot — Risk-First Crypto DCA Bot, Free"
    description="A free crypto DCA bot that buys the dip safely: paper-trade first on live Bybit prices, hard spend limits, honest benchmarks, Telegram alerts. Built for beginners who don't trust bots."
    headline="Buy the dip safely, prove it works, then trade"
    subheadline="A risk-first, Telegram-native crypto DCA bot that paper-trades every dip buy first — so you build trust before you risk a cent."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
