<script setup lang="ts">
const features = [
  {
    title: "Systematic dip buying",
    body: "Turn 'buy the dip' from a meme into a rule: a defined threshold, a fixed size and enforced limits.",
  },
  {
    title: "Every buy is auditable",
    body: "Signals, approvals, rejections and orders are all logged and visible in a real-time feed.",
  },
  {
    title: "Cooldown between buys",
    body: "A configurable cooldown stops the bot from firing repeatedly during the same dip.",
  },
  {
    title: "Dry-run proof",
    body: "Validate the dip-buying edge on live prices before enabling real trades.",
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
    a: "Yes. Every signal, RiskGuard decision and order is written to an audit log you can read on the dashboard.",
  },
  {
    q: "Is it safe to run unattended?",
    a: "It runs dry-run by default and, in live mode, is bounded by spend caps and a cooldown, with a /pause_all kill switch in Telegram.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto Dip Buying Bot"
    title="Crypto Dip Buying Bot"
    description="A risk-first crypto dip buying bot on Bybit spot: threshold-based dip detection, cooldown, full audit logs, dry-run mode and Telegram alerts."
    headline="Turn 'buy the dip' into a disciplined rule"
    subheadline="Systematic dip buying with cooldowns, audit logs and hard limits — and a dry-run mode to prove the edge before you risk capital."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
