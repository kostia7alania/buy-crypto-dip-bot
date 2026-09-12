<script setup lang="ts">
const features = [
  {
    title: "Automated dollar-cost averaging",
    body: "Set a threshold and an amount, and the bot averages into dips for you — no manual timing, no emotional buys.",
  },
  {
    title: "Simulation before real money",
    body: "DCA runs only in dry-run mode so you can inspect simulated decisions on public prices without placing exchange orders. That does not eliminate model or software risk.",
  },
  {
    title: "Hard spend limits",
    body: "Daily and weekly USDT caps are checked before simulated reservation. They limit configured outlay when controls operate correctly.",
  },
  {
    title: "Self-hosted runner and optional Telegram delivery",
    body: "The runner evaluates while its process and dependencies are healthy. Eligible private-chat notifications are queued separately and can fail or retry.",
  },
];
const steps = [
  {
    title: "Set your DCA rule",
    body: "Choose a coin, a dip threshold and a per-buy amount from Telegram or the dashboard.",
  },
  {
    title: "The bot watches prices",
    body: "Each runner interval reads reviewed Bybit spot data and records a signal when the observed drop meets the threshold; risk checks still decide whether to reserve a dry-run order.",
  },
  {
    title: "RiskGuard approves",
    body: "Spend caps, allowlist and cooldown are enforced before any order — automatically.",
  },
  {
    title: "Review the results",
    body: "Track simulated average buy price and unrealized PnL, and judge the strategy on its record rather than a promise.",
  },
];
const faqs = [
  {
    q: "What is a crypto DCA bot?",
    a: "It automatically buys a fixed amount of crypto on a schedule or on dips, averaging your entry price over time instead of trying to time the bottom.",
  },
  {
    q: "Is DCA safer than lump-sum buying?",
    a: "DCA spreads entry timing but can underperform or keep buying into decline. Configured caps and dry-run evidence help inspect behavior; they do not prove suitability or future performance.",
  },
  {
    q: "Can I DCA into multiple coins?",
    a: "The default reviewed allowlist is BTCUSDT, ETHUSDT and SOLUSDT. A stored arbitrary symbol is not evidence of supported market data or future execution capability.",
  },
  {
    q: "Do I need to keep my computer on?",
    a: "The self-hosted server process must remain healthy. Telegram is optional, requires private /start for eligibility and delivery can fail or retry.",
  },
  {
    q: "What settings should I use?",
    a: "There is no universal setting. Choose a bounded amount you can model, document the hypothesis and inspect dry-run decisions across multiple conditions. This product does not provide personal financial advice.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Crypto DCA Bot"
    title="Crypto DCA Bot for Inspectable Dry-Run Decisions"
    description="A self-hosted dry-run crypto DCA bot with reviewed Bybit spot inputs, configured spend checks, simulated order evidence and optional Telegram delivery."
    headline="A crypto DCA bot built for people who don't trust bots"
    subheadline="Inspect dip-DCA decisions, configured limits and simulation assumptions before trusting the workflow."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
