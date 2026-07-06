<script setup lang="ts">
useSeoMeta({
  title: "AI Crypto DCA Bot for Buying the Dip",
  description:
    "Buy Crypto Dip Bot automates risk-first Bitcoin dip buying with dry-run mode, strict limits, audit logs, and Telegram alerts.",
});
</script>

<template>
  <section class="home-hero">
    <p class="eyebrow">Buy Crypto Dip Bot</p>
    <h1>AI Crypto DCA Bot for Buying the Dip Safely</h1>
    <p class="summary">
      Detect crypto dips, run every signal through RiskGuard, create dry-run orders first,
      and keep an audit trail.
    </p>
  </section>
</template>

<style scoped>
.home-hero {
  display: grid;
  gap: 1rem;
  padding-block: 5rem;
}

.eyebrow {
  margin: 0;
  color: #67e8f9;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  max-inline-size: 14ch;
  margin: 0;
  font-size: 4.5rem;
  line-height: 0.98;
}

.summary {
  max-inline-size: 42rem;
  margin: 0;
  color: #cbd5e1;
  font-size: 1.125rem;
  line-height: 1.6;
}

@media (max-width: 40rem) {
  h1 {
    font-size: 2.75rem;
  }
}
</style>
