<script setup lang="ts">
const features = [
  {
    icon: "shield" as const,
    title: "It can't spend more than you allow",
    body: "You set a daily and a weekly budget. The bot physically cannot exceed them — not in a crash, not on a bug, not ever. That's the whole point.",
  },
  {
    icon: "dip" as const,
    title: "Practice mode, on by default",
    body: "It trades with pretend money against real prices until you say otherwise. Watch it work for a few weeks. If the numbers convince you — and only then — go live.",
  },
  {
    icon: "send" as const,
    title: "Lives in your Telegram",
    body: "Every planned buy pings you with a countdown. One tap to cancel, one tap to buy now. No new app, no tab to keep open.",
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
    title: "Free, open, yours",
    body: "Open source, no subscription, and it never holds your money. Run it on your own server if you like.",
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
    a: "Both. It starts in practice mode — real prices, pretend money — so you can judge it risk-free. Live trading on Bybit spot is opt-in, capped by your limits, and can be paused with one command.",
  },
  {
    q: "How do I know the strategy actually works?",
    a: "You watch it prove itself. The dashboard compares its dip-buying against 'buy a bit every day' and 'buy once and hold' with the same money over the same period. If it lags, you'll see that too — honesty is the feature.",
  },
  {
    q: "Is it safe to connect my exchange account?",
    a: "You don't have to — practice mode needs no account at all. Going live uses Bybit API keys that can only trade spot and can never withdraw, so the bot physically cannot move funds out.",
  },
  {
    q: "Does it trade memecoins or use leverage?",
    a: "No, and it never will. No futures, no leverage, no martingale doubling-down, no memecoins. Boring by design — that's what keeps the risk bounded.",
  },
  {
    q: "How much does it cost?",
    a: "Nothing. It's free and open source. If you enable live trading you pay your exchange's normal trading fees — that's it.",
  },
  {
    q: "Which exchange does it work with?",
    a: "Bybit spot, with BTC, ETH and SOL set up out of the box. You can add any Bybit spot pair from Telegram.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="Buy Crypto Dip Bot"
    title="Buy Crypto Dip Bot — Risk-First Crypto DCA Bot, Free"
    description="A free crypto DCA bot that buys the dip safely: paper-trade first on live Bybit prices, hard spend limits, honest benchmarks, Telegram alerts. Built for beginners who don't trust bots."
    headline="The dip-buying bot for people who don't trust bots"
    subheadline="It practices with pretend money until you're convinced, never spends past your limits, and shows you honestly whether it beats doing nothing. All from Telegram."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
