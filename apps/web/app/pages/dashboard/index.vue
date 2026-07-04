<script setup lang="ts">
import type { RiskStatus } from "../../shared/risk-status";

useSeoMeta({ title: "Dashboard", robots: "noindex,nofollow" });

const risk = await $fetch<RiskStatus>("/api/risk-status");
const riskRows = [
  ["Mode", risk.mode],
  ["Live trading", risk.liveTradingEnabled ? "enabled" : "disabled"],
  ["Daily limit", `${risk.maxDailySpendUsdt} USDT`],
  ["Weekly limit", `${risk.maxWeeklySpendUsdt} USDT`],
] as const;
</script>

<template>
  <section class="dashboard-shell">
    <div>
      <p class="eyebrow">Dashboard</p>
      <h1>Risk-first operations</h1>
      <p class="summary">
        Monitor the current safety posture before any order-like action reaches an exchange adapter.
      </p>
    </div>

    <dl class="risk-grid">
      <div v-for="[label, value] in riskRows" :key="label" class="risk-card">
        <dt>{{ label }}</dt>
        <dd>{{ value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.dashboard-shell {
  display: grid;
  gap: 2rem;
  padding-block: 4rem;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: #67e8f9;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  max-inline-size: 12ch;
  margin: 0;
  font-size: 3.5rem;
  line-height: 1;
}

.summary {
  max-inline-size: 42rem;
  margin: 1rem 0 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.risk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
  margin: 0;
}

.risk-card {
  min-block-size: 8rem;
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.72);
}

.risk-card dt {
  color: #94a3b8;
  font-size: 0.875rem;
}

.risk-card dd {
  margin: 0.75rem 0 0;
  color: #f8fafc;
  font-size: 1.25rem;
  font-weight: 700;
}

@media (max-width: 40rem) {
  h1 {
    font-size: 2.5rem;
  }
}
</style>
