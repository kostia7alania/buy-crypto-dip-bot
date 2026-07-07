<script setup lang="ts">
const features = [
  {
    title: "RiskGuard on every action",
    body: "No order exists until it passes spend caps, an allowlist and a cooldown. Risk checks are not optional.",
  },
  {
    title: "Dry-run by default",
    body: "The safest setting is the default: simulate everything until you explicitly choose to go live.",
  },
  {
    title: "Spend caps you set",
    body: "Daily and weekly USDT limits per strategy put a hard ceiling on exposure.",
  },
  {
    title: "Instant kill switch",
    body: "Pause every strategy with one Telegram command, and see every decision in the audit log.",
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
    body: "Cancel pending buys, pause everything, or review the full audit trail at any time.",
  },
];
const faqs = [
  {
    q: "Is a crypto trading bot safe?",
    a: "Only as safe as its limits. A bot without spend caps can drain an account on a bug or a bad market. This bot is built the other way around: dry-run by default, hard daily/weekly caps, spot-only keys with no withdrawal permission, and a one-command kill switch.",
  },
  {
    q: "Is a Telegram crypto bot safe?",
    a: "Telegram is just the interface — safety depends on what the bot can do. This bot never asks for withdrawal-enabled keys, never custodies funds, and every action it takes is capped and logged.",
  },
  {
    q: "What does 'risk-first' actually mean here?",
    a: "Every order must pass RiskGuard — spend caps, an allowlist and a cooldown — and the system defaults to dry-run. Safety is the default, not an add-on.",
  },
  {
    q: "How do spend limits work?",
    a: "You set daily and weekly USDT caps per strategy. When a buy would exceed a cap, RiskGuard rejects it and logs the reason.",
  },
  {
    q: "Can I halt trading immediately?",
    a: "Yes. The /pause_all command in Telegram disables every strategy at once, and /resume_all re-enables them.",
  },
  {
    q: "Is there a record of what the bot did?",
    a: "Every signal, approval, rejection and order is written to an append-only audit log visible on the dashboard.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Risk Management Bot"
    title="Is a Crypto Bot Safe? A Risk-Management-First Trading Bot"
    description="Is a crypto trading bot safe? This one is built risk-first: every order passes spend caps, allowlist and cooldown; dry-run by default, audit logs, kill switch."
    headline="Risk management is the product, not a feature"
    subheadline="Every order passes RiskGuard — spend caps, allowlist and cooldown — with dry-run by default, full audit logs and an instant kill switch."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
