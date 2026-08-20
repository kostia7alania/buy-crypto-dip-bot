<script setup lang="ts">
const features = [
  {
    title: "Simulates dips automatically",
    body: "The bot measures the drop from the 24-hour high and records a dry-run buy when your threshold is hit.",
  },
  {
    title: "Control each pending simulation",
    body: "Each pending dry-run buy is announced in Telegram with Cancel and Buy Now controls before its scheduled transition.",
  },
  {
    title: "Never over-commits",
    body: "Daily and weekly caps plus a cooldown keep dip-buying disciplined during deep drawdowns.",
  },
  {
    title: "Trust before you trade",
    body: "Dry-run mode simulates every buy and shows PnL so you know the strategy works first.",
  },
];
const steps = [
  {
    title: "Define the dip",
    body: "Pick a coin and the percentage drop from the 24h high that counts as a dip worth buying.",
  },
  {
    title: "Wait for the signal",
    body: "The engine polls Bybit spot and fires when price drops enough below the recent high.",
  },
  {
    title: "Guarded execution",
    body: "RiskGuard checks limits and cooldown, then a dry-run order is scheduled with a cancel window.",
  },
  {
    title: "Measure the edge",
    body: "Compare your average buy price to the market and watch unrealized PnL on the dashboard.",
  },
];
const faqs = [
  {
    q: "How does the bot decide when to buy the dip?",
    a: "It tracks the 24-hour high and schedules a simulated buy when the observed price has dropped by at least your configured threshold percentage.",
  },
  {
    q: "Can I stop a buy I don't like?",
    a: "Yes. Every pending simulated buy is posted to Telegram with Cancel and Buy Now buttons before its scheduled transition.",
  },
  {
    q: "What stops it from buying all the way down?",
    a: "RiskGuard enforces daily and weekly spend limits and a cooldown between buys, so it can't over-average in a crash.",
  },
  {
    q: "Is my money at risk while testing?",
    a: "No. Dry-run mode is the default and simulates buys against live prices without touching funds.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="Buy Crypto Dip Bot"
    description="Simulate crypto dip buys on Bybit spot with 24h-high detection, spend caps, an audit trail and Telegram controls."
    headline="Test every crypto dip rule — without risking funds"
    subheadline="Automated dry-run dip buying with a cancel window, hard simulated-spend limits and an auditable workflow."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
