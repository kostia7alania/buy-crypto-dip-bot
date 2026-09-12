<script setup lang="ts">
const features = [
  {
    title: "DCA bot: accumulate on dips",
    body: "A DCA bot buys fixed amounts on a schedule or condition. It spreads entry timing but can keep buying through a prolonged decline.",
  },
  {
    title: "Grid bot: trade the range",
    body: "A grid bot places a ladder of buy and sell orders inside a chosen range. Fees, fills and a broken range can materially change its result.",
  },
  {
    title: "Risk profiles differ",
    body: "Grid and dip-DCA fail differently. A broken grid range can leave inventory; dip-DCA can keep accumulating into a decline. Spend caps limit configured outlay but solve neither market path.",
  },
  {
    title: "Why we chose dip-DCA",
    body: "This product narrows scope to dip-DCA because its dry-run decisions and configured limits are simpler to inspect. That is a product choice, not a universal ranking.",
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
    a: "Neither is universally better. Outcomes depend on market path, fees, fills, range selection, cash flow and user goals. This product only provides a dry-run dip-DCA path.",
  },
  {
    q: "Which is safer for a beginner?",
    a: "There is no general safety winner. A cap limits configured outlay, not asset loss or software risk; a grid adds range, sell and fill assumptions. Suitability requires context this site does not know.",
  },
  {
    q: "Can I run both at once?",
    a: "Some platforms allow it, but this product does not offer a grid bot. Mixing strategies also makes attribution harder; a dry run supplies limited evidence, not proof.",
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
    description="DCA bot vs grid bot compared neutrally: mechanics, assumptions and failure modes, plus the limits of dry-run evidence."
    headline="DCA bot vs grid bot, explained honestly"
    subheadline="Two different mechanisms with different assumptions. Compare how they fail and what a dry run can—and cannot—show."
    :features="features"
    :steps="steps"
    :faqs="faqs"
  />
</template>
