<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { fetchPnl } from "~/entities/pnl";

const { data: pnl, refresh: refreshPnl } = await useAsyncData("pnl", () =>
  fetchPnl(),
);

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  pollingInterval = setInterval(() => {
    refreshPnl();
  }, 15000);
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

const totals = computed(() => pnl.value?.totals ?? null);
const positions = computed(() => pnl.value?.positions ?? []);

const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const sign = (n: number) => (n >= 0 ? "+" : "");

const pnlClass = (n: number) =>
  n >= 0 ? "pnl__value--green" : "pnl__value--red";
</script>

<template>
  <section class="pnl">
    <div class="pnl__header">
      <h2 class="pnl__title">Simulated Portfolio PnL</h2>
      <div v-if="totals && totals.spentUsdt > 0" class="pnl__total" :class="pnlClass(totals.pnlUsdt)">
        {{ sign(totals.pnlUsdt) }}{{ money(totals.pnlUsdt) }} USDT
        ({{ sign(totals.pnlPercent) }}{{ totals.pnlPercent.toFixed(2) }}%)
      </div>
    </div>

    <p v-if="positions.length === 0" class="pnl__empty">
      No simulated purchases yet — PnL appears after the first executed dry-run order.
    </p>

    <div v-else class="pnl__grid">
      <div v-for="p in positions" :key="p.symbol" class="pnl__card">
        <header class="pnl__card-header">
          <span class="pnl__symbol">{{ p.symbol }}</span>
          <span class="pnl__badge">{{ p.orders }} buys</span>
        </header>
        <dl class="pnl__rows">
          <div class="pnl__row">
            <dt>Invested</dt>
            <dd>{{ money(p.spentUsdt) }} USDT</dd>
          </div>
          <div class="pnl__row">
            <dt>Avg buy price</dt>
            <dd>${{ money(p.avgBuyPrice) }}</dd>
          </div>
          <div class="pnl__row">
            <dt>Current price</dt>
            <dd>${{ money(p.currentPrice) }}</dd>
          </div>
          <div class="pnl__row">
            <dt>Value now</dt>
            <dd>{{ money(p.currentValueUsdt) }} USDT</dd>
          </div>
          <div class="pnl__row pnl__row--main">
            <dt>Unrealized PnL</dt>
            <dd :class="pnlClass(p.pnlUsdt)">
              {{ sign(p.pnlUsdt) }}{{ money(p.pnlUsdt) }} USDT
              ({{ sign(p.pnlPercent) }}{{ p.pnlPercent.toFixed(2) }}%)
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pnl {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}

.pnl__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.pnl__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

.pnl__total {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.pnl__empty {
  margin: 0;
  text-align: center;
  padding: 2rem 1rem;
  color: #64748b;
  font-style: italic;
}

.pnl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1.25rem;
}

.pnl__card {
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(30, 41, 59, 0.25);
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pnl__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pnl__symbol {
  font-weight: 800;
  color: #f8fafc;
}

.pnl__badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: rgba(103, 232, 249, 0.1);
  color: #67e8f9;
}

.pnl__rows {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pnl__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.pnl__row dt {
  color: #64748b;
}

.pnl__row dd {
  margin: 0;
  color: #cbd5e1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pnl__row--main {
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.pnl__value--green {
  color: #4ade80 !important;
}

.pnl__value--red {
  color: #f87171 !important;
}
</style>
