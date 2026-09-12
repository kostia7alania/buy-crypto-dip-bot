<script setup lang="ts">
const features = [
  {
    title: "Systematic dip buying",
    body: "Turn 'buy the dip' from a meme into a rule: a defined threshold, a fixed size and enforced limits.",
  },
  {
    title: "Owned decisions leave evidence",
    body: "Covered signal, risk, strategy and simulated-order transitions write tenant-scoped audit records. The feed is evidence, not a claim that every possible failure is captured.",
  },
  {
    title: "Cooldown between buys",
    body: "A configurable cooldown stops the bot from firing repeatedly during the same dip.",
  },
  {
    title: "Dry-run proof",
    body: "Validate the dip-buying edge on live prices with simulated orders — the only kind the bot places today.",
  },
];
const steps = [
  {
    title: "Configure the strategy",
    body: "Set the dip threshold, buy amount and limits per coin.",
  },
  {
    title: "Detect the drop",
    body: "The engine compares live price to the 24h high on Bybit spot each tick.",
  },
  {
    title: "Approve and schedule",
    body: "RiskGuard validates the signal, then schedules a dry-run buy with a Telegram cancel window.",
  },
  {
    title: "Analyze performance",
    body: "Review average entry, current value and unrealized PnL to judge the strategy.",
  },
];
const faqs = [
  {
    q: "What is a dip-buying bot?",
    a: "A bot that automatically buys an asset when its price drops by a set amount from a recent high, removing hesitation and emotion from the decision.",
  },
  {
    q: "How is this different from a grid bot?",
    a: "Grid bots trade a range continuously. This bot specifically targets dips from the 24h high and is built around risk limits and a dry-run-first workflow.",
  },
  {
    q: "Can I see why it did or didn't buy?",
    a: "The implemented signal, risk and simulated-order paths write tenant-scoped audit records that the dashboard can show. Audit coverage remains versioned and must not be generalized to unimplemented paths.",
  },
  {
    q: "Is it safe to run unattended?",
    a: "The current build simulates buys only. Configured spend checks, cooldown and an audited pause operation reduce unattended exposure, but do not remove data, software, configuration or strategy risk.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Dip Buying Bot"
    title="Buy the Dip Bot — Dry-Run Crypto Dip Rules"
    description="A self-hosted dry-run dip bot: threshold-based signals on reviewed Bybit spot data, cooldown, tenant-scoped audit evidence and optional Telegram delivery."
    headline="Turn 'buy the dip' into a disciplined rule"
    subheadline="Systematic dry-run decisions with cooldowns, audit evidence and configured limits—useful for inspection, not proof of an edge."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
