<script setup lang="ts">
const features = [
  {
    title: "Buys dips automatically",
    body: "The bot measures the drop from the 24-hour high and buys when your threshold is hit — no staring at charts.",
  },
  {
    title: "Cancel any buy in time",
    body: "Each pending buy is announced in Telegram with a live countdown so you can cancel or execute instantly.",
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
    a: "It tracks the 24-hour high and buys when the current price has dropped by at least your configured threshold percentage.",
  },
  {
    q: "Can I stop a buy I don't like?",
    a: "Yes. Every pending buy is posted to Telegram with Cancel and Buy Now buttons and a countdown before it executes.",
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
    description="Automatically buy crypto dips on Bybit spot with a risk-first bot: 24h-high dip detection, spend caps, dry-run mode and Telegram alerts."
    headline="Buy every crypto dip — without the stress"
    subheadline="Automated dip buying with a cancel window, hard spend limits and a simulation-first workflow you can actually trust."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
