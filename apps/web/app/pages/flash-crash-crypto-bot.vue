<script setup lang="ts">
const features = [
  {
    title: "Catches sharp drops",
    body: "When an observed price drops from its 24h high, the bot can record a dry-run response without manual chart watching.",
  },
  {
    title: "Bounded by design",
    body: "Daily and weekly caps limit simulated spend while you study how the rules behave in a sharp decline.",
  },
  {
    title: "Cancel window",
    body: "Every pending simulated buy is announced with Cancel and Buy Now controls before its scheduled transition.",
  },
  {
    title: "Kill switch",
    body: "One /pause_all command in Telegram instantly halts every strategy if you want to sit out.",
  },
];
const steps = [
  {
    title: "Set the trigger",
    body: "Choose how far below the 24h high counts as a crash worth buying.",
  },
  {
    title: "Monitor continuously",
    body: "The engine polls Bybit spot on a short interval to catch sudden drops.",
  },
  {
    title: "Risk-checked entry",
    body: "RiskGuard validates the buy against your limits before scheduling a dry-run order.",
  },
  {
    title: "Review and adjust",
    body: "See how flash-crash buys performed and tune your threshold.",
  },
];
const faqs = [
  {
    q: "Can a bot really catch a flash crash?",
    a: "This bot samples public Bybit prices on a schedule and records simulated responses when a configured threshold is met. It is not a tick-level execution system.",
  },
  {
    q: "Isn't buying a crash risky?",
    a: "That's why this bot is risk-first: spend caps, a cooldown and a dry-run mode bound the downside so you can test the idea safely.",
  },
  {
    q: "What if the crash keeps going?",
    a: "Daily and weekly limits cap total spend, and the /pause_all kill switch stops everything instantly if you choose to.",
  },
  {
    q: "Do I need to watch the market?",
    a: "No. The bot watches continuously and alerts you in Telegram, so you don't have to sit at the screen.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Flash Crash Crypto Bot"
    title="Flash Crash Crypto Bot"
    description="A risk-first flash-crash simulator that detects sharp Bybit spot drops and records dry-run orders within strict spend limits."
    headline="Be ready for the flash crash"
    subheadline="Simulate responses to sharp Bybit spot drops with hard limits, a cancel window and an instant dry-run kill switch."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
