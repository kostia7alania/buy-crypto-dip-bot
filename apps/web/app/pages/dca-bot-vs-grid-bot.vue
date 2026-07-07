<script setup lang="ts">
const features = [
  {
    title: "DCA bot: accumulate on dips",
    body: "A DCA bot buys fixed amounts as price falls, lowering your average entry. Best for long-term accumulation of coins you believe in.",
  },
  {
    title: "Grid bot: trade the range",
    body: "A grid bot places a ladder of buy and sell orders inside a range, profiting from sideways volatility — but it needs a range that holds.",
  },
  {
    title: "Risk profiles differ",
    body: "Grid bots can be left holding the top of a broken range. Dip-DCA never sells, so the main risk is buying too much too early — which spend caps solve.",
  },
  {
    title: "Why we chose dip-DCA",
    body: "For accumulation with bounded risk, dip-buying DCA with hard limits is simpler to reason about — and easier to verify in a dry run.",
  },
];
const steps = [
  {
    title: "Decide your goal",
    body: "Accumulating an asset long-term? DCA. Harvesting sideways volatility with active ranges? Grid.",
  },
  {
    title: "Compare the failure modes",
    body: "Grid: range breaks down and you hold losses. DCA: prolonged downtrend — mitigated by spend caps and cooldowns.",
  },
  {
    title: "Test without money",
    body: "Run our dip-DCA in dry-run mode and compare it against calendar DCA and buy-and-hold on the dashboard.",
  },
  {
    title: "Commit small, scale later",
    body: "Whichever style you pick, start with a small capped budget and scale only after results.",
  },
];
const faqs = [
  {
    q: "DCA bot vs grid bot — which is better?",
    a: "Neither is universally better. DCA bots suit long-term accumulation and falling or choppy markets; grid bots suit clearly ranging markets. For beginners, dip-DCA with spend caps is easier to reason about and safer to test.",
  },
  {
    q: "Which is safer for a beginner?",
    a: "A capped DCA bot is generally safer: it never sells at a loss and its worst case is bounded by your spend limits. Grid bots require choosing a range — a wrong range means holding losses.",
  },
  {
    q: "Can I run both at once?",
    a: "Some platforms allow it, but mixing strategies makes results hard to attribute. Prove one strategy in simulation first — that's exactly what our dry-run mode is for.",
  },
  {
    q: "Does this site offer a grid bot?",
    a: "No, deliberately. We focus on risk-first dip-buying DCA on spot markets and benchmark it honestly against calendar DCA and buy-and-hold.",
  },
];
</script>

<template>
  <LandingPage
    eyebrow="DCA Bot vs Grid Bot"
    title="DCA Bot vs Grid Bot: Which Is Better?"
    description="DCA bot vs grid bot compared: how each works, their failure modes, which is safer for beginners, and how to test either without risking money."
    headline="DCA bot vs grid bot, explained honestly"
    subheadline="Two different tools for two different markets. Here's how they fail, which suits accumulation, and how to prove a strategy before funding it."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
