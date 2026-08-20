<script setup lang="ts">
const features = [
  {
    icon: "shield" as const,
    title: "Budgets checked before every simulated buy",
    body: "You set daily and weekly limits. RiskGuard rejects a simulated order when it would exceed them and records the reason.",
  },
  {
    icon: "dip" as const,
    title: "Practice mode is the product today",
    body: "It uses pretend money against public Bybit prices. The current release never places an order on your exchange account.",
  },
  {
    icon: "send" as const,
    title: "Lives in your Telegram",
    body: "Every planned simulated buy pings you with a countdown. One tap cancels it; one tap completes it now in the dry-run ledger.",
  },
  {
    icon: "scale" as const,
    title: "Compared against 'doing nothing'",
    body: "The dashboard shows how dip-buying stacks up against just buying every day, or buying once and holding. When it loses, you'll see that too.",
  },
  {
    icon: "audit" as const,
    title: "Every decision on the record",
    body: "Why it bought, why it didn't, what got blocked by your limits — all logged, all visible. No black box.",
  },
  {
    icon: "open" as const,
    title: "Open source and self-hosted",
    body: "The code has no subscription and never holds funds. Your server, database and domain can still have provider costs.",
  },
];

const steps = [
  {
    title: "Tell it what a dip means to you",
    body: "Pick a coin, how big a drop counts as a dip (say, 2% off the day's high), and how much to buy each time.",
  },
  {
    title: "It watches the market so you don't",
    body: "While your self-hosted services are running, the bot checks public Bybit prices on a schedule.",
  },
  {
    title: "A dip hits — you get a heads-up",
    body: "Telegram message, 15-second countdown. Do nothing and the (simulated) buy goes through. Not feeling it? Tap cancel.",
  },
  {
    title: "The numbers tell the story",
    body: "Average buy price, profit and loss, and an honest comparison against simpler strategies — on one dashboard.",
  },
];

const faqs = [
  {
    q: "Is this a real trading bot or a simulation?",
    a: "The current release is a simulation: public Bybit prices, pretend money and no exchange orders. Live execution would require a separate future executor and is not available today.",
  },
  {
    q: "How do I know the strategy actually works?",
    a: "You watch it prove itself. The dashboard compares its dip-buying against 'buy a bit every day' and 'buy once and hold' with the same money over the same period. If it lags, you'll see that too — honesty is the feature.",
  },
  {
    q: "Is it safe to connect my exchange account?",
    a: "Do not connect one. The current release needs no private exchange key and has no live order adapter; it reads public Bybit market data only.",
  },
  {
    q: "Does it trade memecoins or use leverage?",
    a: "No, and it never will. No futures, no leverage, no martingale doubling-down, no memecoins. Boring by design — that's what keeps the risk bounded.",
  },
  {
    q: "How much does it cost?",
    a: "The code is free and open source. Self-hosting, a domain, database usage and other provider resources may still cost money.",
  },
  {
    q: "Which exchange does it work with?",
    a: "It reads public Bybit spot data for dry-run strategies. BTC, ETH and SOL are available in the onboarding flow; live exchange trading is not supported.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="Buy Crypto Dip Bot - Risk-First Paper Trading Bot"
    description="A free, open-source crypto DCA simulator: paper-trade dip signals on public Bybit prices with spend limits, benchmarks and Telegram alerts. No live exchange orders."
    headline="The dip-buying bot for people who don't trust bots"
    subheadline="It practices with pretend money, checks every simulated order against your limits, and shows whether dip-buying beats simpler baselines. All from Telegram."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
