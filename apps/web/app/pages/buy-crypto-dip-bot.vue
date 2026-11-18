<script setup lang="ts">
const features = [
  {
    title: "Detects dips automatically",
    body: "The bot measures the drop from the 24-hour high and simulates a buy when your threshold and risk checks are met.",
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
    title: "Review the results",
    body: "Compare your simulated average buy price to the market and watch unrealized PnL on the dashboard.",
  },
];
const faqs = [
  {
    q: "How does the bot decide when to buy the dip?",
    a: "It tracks the 24-hour high and schedules a simulated buy when the drop meets your threshold and risk checks pass.",
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
    a: "No exchange funds are used. The current build only simulates buys against observed prices.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="Buy Crypto Dip Bot"
    description="Simulate crypto dip buys on Bybit spot data with 24h-high dip detection, spend caps and optional Telegram alerts."
    headline="Inspect a rule for buying crypto dips"
    subheadline="Dry-run dip decisions with configured limits, optional notification controls and evidence you can review before trusting the automation."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
