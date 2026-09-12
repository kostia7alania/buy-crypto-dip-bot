<script setup lang="ts">
const features = [
  {
    title: "RiskGuard before dry-run reservation",
    body: "A simulated order is reserved only after the implemented spend, allowlist and cooldown checks pass for that decision.",
  },
  {
    title: "Dry-run by default",
    body: "Everything is simulated. This avoids exchange order submission but does not eliminate software, data, configuration or interpretation risk.",
  },
  {
    title: "Spend caps you set",
    body: "Daily and weekly USDT limits per strategy bound configured simulated outlay when the controls operate correctly.",
  },
  {
    title: "Audited pause operation",
    body: "The Telegram pause command requests an owner-scoped update and records the committed state transition. Confirmation matters; it is not described as instantaneous.",
  },
];
const steps = [
  {
    title: "Set your limits",
    body: "Define daily and weekly spend caps, allowed symbols and a cooldown per strategy.",
  },
  {
    title: "Signals get filtered",
    body: "Each buy signal is evaluated against those limits before anything happens.",
  },
  {
    title: "Rejections are logged",
    body: "If a signal is blocked, the reason is recorded and surfaced on the dashboard.",
  },
  {
    title: "You stay in control",
    body: "Request pending-buy cancellation, pause owned strategies, or review the tenant-scoped audit feed.",
  },
];
const faqs = [
  {
    q: "Is a crypto trading bot safe?",
    a: "No trading automation is inherently safe. This shipped build is DRY_RUN-only and has no private exchange-key path. Configured caps and an audited pause operation reduce exposure but do not eliminate defects or bad decisions.",
  },
  {
    q: "Is a Telegram crypto bot safe?",
    a: "Telegram is an identity and optional delivery interface. The shipped product asks for no exchange keys and places no exchange orders. Delivery can fail, and audit coverage is limited to implemented, versioned paths.",
  },
  {
    q: "What does 'risk-first' actually mean here?",
    a: "The product is DRY_RUN-only and checks configured spend caps, the reviewed allowlist and cooldown before simulated reservation. These controls are inspectable but cannot ensure safety.",
  },
  {
    q: "How do spend limits work?",
    a: "You set daily and weekly USDT caps per strategy. When a buy would exceed a cap, RiskGuard rejects it and logs the reason.",
  },
  {
    q: "Can I halt trading immediately?",
    a: "The owner-scoped /pause_all and /resume_all commands request atomic strategy updates with audit evidence. Treat only the confirmed result as effective.",
  },
  {
    q: "Is there a record of what the bot did?",
    a: "Implemented signal, risk, strategy and simulated-order transitions write tenant-scoped audit records. The current feed does not justify claiming coverage for every possible event or failure.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Risk Management Bot"
    title="Crypto Bot Risk Controls — Inspect the Dry-Run Evidence"
    description="A DRY_RUN-only crypto bot with configured spend checks, a reviewed allowlist, cooldown, tenant-scoped audit evidence and an audited pause operation."
    headline="Risk management is the product, not a feature"
    subheadline="Inspect configured RiskGuard checks, tenant-scoped evidence and confirmed pause transitions without exchange keys or live orders."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
