<script setup lang="ts">
const features = [
  {
    title: "Catches sharp drops",
    body: "The runner polls reviewed public symbols and can record a dry-run decision when the observed drop crosses the configured threshold.",
  },
  {
    title: "Bounded by design",
    body: "Daily and weekly caps are checked before simulated reservation. They reduce configured exposure but do not remove software, data or market risk.",
  },
  {
    title: "Cancel window",
    body: "Eligible private-chat messages can include a cosmetic countdown. Delivery failure does not pause or control database-driven simulated execution.",
  },
  {
    title: "Audited pause command",
    body: "The /pause_all command requests an owner-scoped strategy update and records the committed transition. Its result must be confirmed rather than assumed instant.",
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
    a: "This runner polls on an interval rather than every market tick. It may observe a sudden drop, but network latency, polling cadence and stale data can cause a miss or delayed decision.",
  },
  {
    q: "Isn't buying a crash risky?",
    a: "Buying a crash is risky. Spend checks, a cooldown and dry-run evidence help inspect the rule without placing exchange orders; they do not prove the strategy or bound market loss in a future live system.",
  },
  {
    q: "What if the crash keeps going?",
    a: "Daily and weekly limits are checked before simulated reservations. /pause_all requests an owner-scoped disable operation whose confirmed result is recorded; neither control predicts the market path.",
  },
  {
    q: "Do I need to watch the market?",
    a: "The self-hosted runner polls while its process and dependencies are healthy. Telegram delivery is optional and can fail, so readiness and delivery evidence still need monitoring.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Flash Crash Crypto Bot"
    title="Flash Crash Crypto Bot"
    description="A risk-first flash-crash bot that buys sharp crypto drops on Bybit spot within strict spend limits, with a dry-run mode, cancel window and kill switch."
    headline="Be ready for the flash crash"
    subheadline="Evaluate sharp-drop rules on reviewed public Bybit data with configured limits, dry-run evidence and an audited pause control."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
