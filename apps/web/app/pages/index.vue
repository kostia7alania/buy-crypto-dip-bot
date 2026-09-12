<script setup lang="ts">
const features = [
  {
    icon: "shield" as const,
    title: "Configured spend limits are checked first",
    body: "RiskGuard checks per-buy, daily and weekly limits before a dry-run order is reserved. These software controls reduce exposure but cannot rule out defects or bad configuration.",
  },
  {
    icon: "dip" as const,
    title: "Practice mode, and only practice mode",
    body: "It records simulated orders from public Bybit prices. That is everything it does today. Exchange credentials and live order placement are not available.",
  },
  {
    icon: "send" as const,
    title: "Private Telegram delivery, when enabled",
    body: "Signing in does not enable alerts. Start the bot in a private chat first; eligible messages are queued with delivered, retry and failed evidence. Countdown edits are cosmetic.",
  },
  {
    icon: "scale" as const,
    title: "Compared against 'doing nothing'",
    body: "The dashboard shows how dip-buying stacks up against just buying every day, or buying once and holding. When it loses, you'll see that too.",
  },
  {
    icon: "audit" as const,
    title: "Covered decisions leave tenant-scoped evidence",
    body: "Implemented signal, risk, strategy and simulated-order transitions write audit records you can inspect. Coverage remains versioned rather than assumed universal.",
  },
  {
    icon: "open" as const,
    title: "Self-hosted dry-run software",
    body: "There is no hosted subscription or exchange-account connection today. Running the repository yourself still carries infrastructure and operating costs.",
  },
];

const steps = [
  {
    title: "Tell it what a dip means to you",
    body: "Pick a coin, how big a drop counts as a dip (say, 2% off the day's high), and how much to buy each time.",
  },
  {
    title: "It watches the market so you don't",
    body: "The bot checks prices around the clock. You get on with your life.",
  },
  {
    title: "A dip hits — you get a heads-up",
    body: "If private-chat delivery is enabled, a queued Telegram message can offer cancel or execute-now controls. Delivery and countdown edits are not prerequisites for the database-driven simulated execution.",
  },
  {
    title: "The numbers tell the story",
    body: "Average buy price, profit and loss, and an honest comparison against simpler strategies — on one dashboard.",
  },
];

const faqs = [
  {
    q: "Is this a real trading bot or a simulation?",
    a: "A dry-run simulation today. It uses public Bybit price observations and simulated funds. It does not prove fills, fees, slippage, liquidity, latency or reconciliation, and live trading is unavailable.",
  },
  {
    q: "How do I know the strategy actually works?",
    a: "Treat the dashboard as limited evidence, not proof. It compares dip-buying with simplified calendar-DCA and buy-and-hold baselines over a data window; fees, slippage, fill behavior and missing data can change real outcomes.",
  },
  {
    q: "Is it safe to connect my exchange account?",
    a: "There is nothing to connect today. The shipped path reads public prices and has no private exchange credential or order-submission path. Do not give this build withdrawal, transfer, margin or derivatives permission.",
  },
  {
    q: "Does it trade memecoins or use leverage?",
    a: "No. The current product policy prohibits futures, leverage, martingale, withdrawals and meme-coin trading. Policy and software controls reduce exposure but do not eliminate risk.",
  },
  {
    q: "How much does it cost?",
    a: "No hosted plan or tariff is offered. A self-hosted install has infrastructure and operating costs. Dry-run orders do not charge exchange trading fees, which is also one reason their results are not equivalent to live execution.",
  },
  {
    q: "Which exchange does it work with?",
    a: "Public Bybit spot market data, with BTCUSDT, ETHUSDT and SOLUSDT in the default reviewed allowlist. A stored strategy does not make an arbitrary symbol supported.",
  },
  {
    q: "What works today?",
    a: "As of 2 August 2026: self-hosted DRY_RUN strategy evaluation, spend checks, simulated order evidence, a tenant-scoped dashboard and optional private-chat notifications. Hosted SaaS, private exchange keys, Demo orders and live trading are not offered.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="Buy Crypto Dip Bot — Risk-First Dry-Run Crypto DCA"
    description="A self-hosted dry-run crypto DCA bot using public Bybit prices, configurable spend limits, benchmark views and optional Telegram delivery. No exchange keys or live orders."
    headline="The dip-buying bot for people who don't trust bots"
    subheadline="Inspect simulated decisions, configured limits and benchmark evidence before trusting an automation. No exchange keys and no live orders."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
