<script setup lang="ts">
import { computed } from "vue";
import type { PnlReport } from "~/entities/pnl";
import { formatMoney } from "~/shared/lib/number-format";

const props = defineProps<{ pnl?: PnlReport; error?: unknown }>();

const totals = computed(() => props.pnl?.totals ?? null);
const positions = computed(() => props.pnl?.positions ?? []);

const money = (value: number) => formatMoney(value);
const sign = (n: number) => (n >= 0 ? "+" : "");

const pnlClass = (n: number) =>
  n >= 0 ? "pnl__value--green" : "pnl__value--red";

const incomplete = computed(
  () => props.pnl?.status === "PARTIAL" || props.pnl?.status === "UNAVAILABLE",
);
</script>

<template>
  <section class="pnl">
    <div class="pnl__header">
      <h2 class="pnl__title">Simulated Portfolio PnL</h2>
      <div v-if="!props.error && totals && totals.spentUsdt > 0 && totals.pnlUsdt !== null && totals.pnlPercent !== null" class="pnl__total" :class="pnlClass(totals.pnlUsdt)">
        {{ sign(totals.pnlUsdt) }}{{ money(totals.pnlUsdt) }} USDT
        ({{ sign(totals.pnlPercent) }}{{ totals.pnlPercent.toFixed(2) }}%)
      </div>
    </div>
    <p class="pnl__note">DRY_RUN. Fees and slippage are not modelled.</p>
    <p v-if="!props.error && incomplete && totals" class="pnl__note" role="status">
      {{ props.pnl?.status === 'PARTIAL' ? 'Partial valuation' : 'Valuation unavailable' }}.
      Total PnL is unavailable. Recorded spend: {{ money(totals.spentUsdt) }} USDT.
    </p>

    <p v-if="props.error" class="pnl__empty">Portfolio data is unavailable.</p>
    <p v-else-if="!props.pnl" class="pnl__empty">Loading portfolio data...</p>
    <p v-else-if="positions.length === 0" class="pnl__empty">
      No simulated purchases yet.
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
            <dt>Quoted price</dt>
            <dd>{{ p.currentPrice === null ? 'Unavailable' : `$${money(p.currentPrice)}` }}</dd>
          </div>
          <div class="pnl__row">
            <dt>Quoted value</dt>
            <dd>{{ p.currentValueUsdt === null ? 'Unavailable' : `${money(p.currentValueUsdt)} USDT` }}</dd>
          </div>
          <div class="pnl__row pnl__row--main">
            <dt>Unrealized PnL</dt>
            <dd v-if="p.pnlUsdt !== null && p.pnlPercent !== null" :class="pnlClass(p.pnlUsdt)">
              {{ sign(p.pnlUsdt) }}{{ money(p.pnlUsdt) }} USDT
              ({{ sign(p.pnlPercent) }}{{ p.pnlPercent.toFixed(2) }}%)
            </dd>
            <dd v-else>Unavailable</dd>
          </div>
        </dl>
        <p v-if="p.issue" class="pnl__note">
          {{ p.issue === 'STALE_MARKET' ? 'Quote is stale.' : 'Quote is unavailable.' }} Recorded holdings are retained.
        </p>
        <p v-if="p.quote" class="pnl__note">Quote as of <time :datetime="p.quote.sourceAt">{{ p.quote.sourceAt }}</time></p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pnl {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.pnl__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.pnl__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.pnl__total {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}

.pnl__note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
  overflow-wrap: anywhere;
}

.pnl__empty {
  margin: 0;
  text-align: center;
  padding: var(--space-8) var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-subtle);
}

.pnl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
  gap: var(--space-4);
}

.pnl__card {
  padding: var(--space-5);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pnl__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pnl__symbol {
  font-weight: 800;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.pnl__badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-simulation-border);
  border-radius: var(--radius-pill);
  background: var(--color-simulation-soft);
  color: var(--color-simulation);
  font-family: var(--font-mono);
}

.pnl__rows {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pnl__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  gap: var(--space-3);
  overflow-wrap: anywhere;
}

.pnl__row dt {
  color: var(--color-text-subtle);
}

.pnl__row dd {
  margin: 0;
  color: var(--color-text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  text-align: end;
}

.pnl__row--main {
  padding-block-start: var(--space-2);
  border-block-start: 1px solid var(--color-border-subtle);
}

.pnl__total.pnl__value--green,
.pnl__row .pnl__value--green {
  color: var(--color-success);
}

.pnl__total.pnl__value--red,
.pnl__row .pnl__value--red {
  color: var(--color-danger);
}

@media (max-width: 36rem) {
  .pnl {
    padding: var(--space-5);
  }

  .pnl__row {
    align-items: start;
    gap: var(--space-4);
  }
}
</style>
