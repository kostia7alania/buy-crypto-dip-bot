<script setup lang="ts">
const features = [
  {
    title: "Automated DCA simulation",
    body: "Set a threshold and amount, and the bot records simulated dip buys so you can evaluate the rule without committing capital.",
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
    body: "It samples Bybit spot on a schedule and triggers a simulated buy when the drop from the 24h high meets your threshold.",
  },
  {
    title: "RiskGuard approves",
    body: "Spend caps, allowlist and cooldown are enforced before any order — automatically.",
  },
  {
    title: "Review the results",
    body: "Track average simulated buy price, unrealized PnL and benchmark comparisons to judge the hypothesis.",
  },
];
const faqs = [
  {
    q: "What is a crypto DCA bot?",
    a: "A DCA bot applies a fixed recurring or dip-based rule. This release simulates those buys and never submits them to an exchange.",
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
  {
    q: "What are the best DCA bot settings?",
    a: "Start conservative: a 1–2% dip threshold, a small fixed buy amount, daily and weekly spend caps you can afford, and a cooldown of at least an hour. Then tune based on dry-run results, not gut feeling.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto DCA Bot"
    title="Best Crypto DCA Bot for Beginners — Dry-Run First & Free"
    description="Looking for the best crypto DCA bot? Ours dollar-cost averages into dips on Bybit spot with dry-run mode, hard spend caps and Telegram alerts — free."
    headline="A crypto DCA bot built for people who don't trust bots"
    subheadline="Automate DCA into the dips with strict limits and a simulation-first workflow — averaging done safely, not blindly."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
