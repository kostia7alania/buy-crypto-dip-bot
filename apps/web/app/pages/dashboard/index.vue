<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import {
  getRunnerConnection,
  type RunnerStatusResponse,
} from "~/entities/runner";

useSeoMeta({ title: "Dashboard", robots: "noindex,nofollow" });

const { data: risk, refresh: refreshRisk } =
  await useFetch<RunnerStatusResponse>("/api/risk-status", {
    key: "risk-status",
  });

let statusInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  statusInterval = setInterval(() => refreshRisk(), 10000);
});
onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval);
});

const connection = computed(() => getRunnerConnection(risk.value));
</script>

<template>
  <section class="ops-dashboard">
    <!-- Header -->
    <header class="ops-dashboard__header">
      <div class="ops-dashboard__header-content">
        <span class="ops-dashboard__eyebrow">Buy Crypto Dip Bot Ops</span>
        <h1 class="ops-dashboard__title">Real-time Operations</h1>
        <p class="ops-dashboard__summary">
          Monitoring the safety engine, strategy triggers, and simulated order book in real-time.
        </p>
      </div>
      <div class="ops-dashboard__header-side">
        <TelegramLoginWidget />
        <div
          class="ops-dashboard__status"
          :class="`ops-dashboard__status--${connection.state}`"
        >
          <div
            class="ops-dashboard__pulse-dot"
            :class="`ops-dashboard__pulse-dot--${connection.state}`"
          ></div>
          <span>{{ connection.label }}</span>
        </div>
      </div>
    </header>

    <!-- Risk Section -->
    <RiskGuardWidget />

    <!-- Simulated PnL: does the strategy actually work? -->
    <PnlWidget />

    <!-- The proof: dip-buying vs naive benchmarks -->
    <PerformanceWidget />

    <!-- The time machine: replay the rules over real history -->
    <BacktestWidget />

    <!-- Strategies Section -->
    <StrategyListWidget />

    <!-- Two Column Ledger & Feed -->
    <div class="ops-dashboard__two-columns">
      <OrderLedgerWidget />
      <AuditFeedWidget />
    </div>
  </section>
</template>

<style scoped>
.ops-dashboard {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding-block: 4rem;
}

.ops-dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.ops-dashboard__header-content {
  flex: 1;
}

.ops-dashboard__eyebrow {
  margin: 0 0 0.75rem;
  color: #67e8f9;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ops-dashboard__title {
  margin: 0;
  font-size: 3rem;
  line-height: 1.1;
  font-weight: 800;
  background: linear-gradient(135deg, #ffffff 30%, #a5f3fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ops-dashboard__summary {
  max-inline-size: 42rem;
  margin: 1rem 0 0;
  color: #94a3b8;
  font-size: 1.1rem;
  line-height: 1.6;
}

.ops-dashboard__header-side {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.ops-dashboard__status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(103, 232, 249, 0.25);
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #e2e8f0;
}

.ops-dashboard__pulse-dot {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  animation: pulse 1.6s infinite;
}

.ops-dashboard__status--offline {
  border-color: rgba(248, 113, 113, 0.35);
  color: #fca5a5;
}

.ops-dashboard__pulse-dot--offline {
  background: #f87171;
  box-shadow: none;
  animation: none;
}

.ops-dashboard__status--stale {
  border-color: rgba(250, 204, 21, 0.35);
  color: #fde68a;
}

.ops-dashboard__pulse-dot--stale {
  background: #facc15;
  box-shadow: none;
  animation: none;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

.ops-dashboard__two-columns {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 2rem;
}

@media (max-width: 64rem) {
  .ops-dashboard__two-columns {
    grid-template-columns: 1fr;
  }
}
</style>
