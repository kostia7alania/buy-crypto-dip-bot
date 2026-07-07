<script setup lang="ts">
const features = [
  {
    title: "Catches sharp drops",
    body: "When price gaps down from its 24h high, the bot is already watching — and can act faster than you can.",
  },
  {
    title: "Bounded by design",
    body: "A flash crash won't drain your account: daily and weekly caps limit total exposure automatically.",
  },
  {
    title: "Cancel window",
    body: "Even in fast markets, every buy is announced with a countdown so you stay in control.",
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
    a: "A bot reacts on every price tick without hesitation, so it can act on sudden drops faster than manual trading — within your pre-set rules.",
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
    description="A risk-first flash-crash bot that buys sharp crypto drops on Bybit spot within strict spend limits, with a dry-run mode, cancel window and kill switch."
    headline="Be ready for the flash crash"
    subheadline="Automatically buy sharp drops on Bybit spot — bounded by hard limits, a cancel window and an instant kill switch, tested safely in dry-run first."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
