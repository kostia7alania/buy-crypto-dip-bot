<script setup lang="ts">
const features = [
  {
    title: "Automated dollar-cost averaging",
    body: "Set a threshold and an amount, and the bot averages into dips for you — no manual timing, no emotional buys.",
  },
  {
    title: "Simulation before real money",
    body: "DCA runs in dry-run mode first so you can validate the strategy on live prices with zero risk.",
  },
  {
    title: "Hard spend limits",
    body: "Daily and weekly USDT caps stop the bot from over-averaging in a prolonged downtrend.",
  },
  {
    title: "Runs 24/7 in Telegram",
    body: "The market never sleeps; neither does the bot. You just get alerts and a dashboard.",
  },
];
const steps = [
  {
    title: "Set your DCA rule",
    body: "Choose a coin, a dip threshold and a per-buy amount from Telegram or the dashboard.",
  },
  {
    title: "The bot watches prices",
    body: "It checks Bybit spot every tick and triggers a buy when the drop from the 24h high meets your threshold.",
  },
  {
    title: "RiskGuard approves",
    body: "Spend caps, allowlist and cooldown are enforced before any order — automatically.",
  },
  {
    title: "Review the results",
    body: "Track average buy price and unrealized PnL and decide when to go live.",
  },
];
const faqs = [
  {
    q: "What is a crypto DCA bot?",
    a: "It automatically buys a fixed amount of crypto on a schedule or on dips, averaging your entry price over time instead of trying to time the bottom.",
  },
  {
    q: "Is DCA safer than lump-sum buying?",
    a: "DCA spreads risk across time and removes emotion. This bot adds spend caps and a dry-run mode so you can prove the approach before committing capital.",
  },
  {
    q: "Can I DCA into multiple coins?",
    a: "Yes. Add a strategy per symbol (BTC, ETH, SOL and more) each with its own threshold, amount and limits.",
  },
  {
    q: "Do I need to keep my computer on?",
    a: "No. It runs on a server and talks to you through Telegram and a web dashboard.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto DCA Bot"
    title="Crypto DCA Bot"
    description="A risk-first crypto DCA bot that dollar-cost averages into dips on Bybit spot, with dry-run mode, spend caps and Telegram alerts."
    headline="Dollar-cost average into crypto, on autopilot"
    subheadline="Automate DCA into the dips with strict limits and a simulation-first workflow — averaging done safely, not blindly."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
