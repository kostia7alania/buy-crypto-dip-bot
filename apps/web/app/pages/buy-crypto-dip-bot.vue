<script setup lang="ts">
const features = [
  {
    title: "Buys dips automatically",
    body: "The bot measures the drop from the 24-hour high and buys when your threshold is hit — no staring at charts.",
  },
  {
    title: "Optional pending-order controls",
    body: "Eligible private-chat notifications can expose cancel or execute-now controls. Delivery and countdown edits are recorded separately and do not control due-order execution.",
  },
  {
    title: "Configured limits before reservation",
    body: "Daily and weekly caps plus a cooldown are checked before a dry-run order is reserved. These controls cannot ensure a strategy outcome.",
  },
  {
    title: "Trust before you trade",
    body: "Dry-run records simulated buys and valuation evidence so you can inspect behavior and limitations; it cannot prove that the strategy works with real capital.",
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
    a: "Only when private /start has enabled an eligible delivery binding and Telegram accepts the message. Cancel and execute-now controls are optional; database execution does not depend on countdown delivery.",
  },
  {
    q: "What stops it from buying all the way down?",
    a: "RiskGuard checks daily and weekly spend limits plus a cooldown before reservation. Those configured controls bound simulated spend when operating correctly; they do not make a crash strategy safe or profitable.",
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
    headline="Inspect a rule for buying crypto dips"
    subheadline="Dry-run dip decisions with configured limits, optional notification controls and evidence you can review before trusting the automation."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
