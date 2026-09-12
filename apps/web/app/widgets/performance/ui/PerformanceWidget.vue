<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import {
  fetchPerformance,
  type PerformancePosition,
} from "~/entities/performance";

const { data, refresh } = await useAsyncData("performance", () =>
  fetchPerformance(),
);

let pollingInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  pollingInterval = setInterval(() => refresh(), 30000);
});
onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

const positions = computed(() => data.value?.positions ?? []);

const sign = (n: number) => (n >= 0 ? "+" : "");
const pct = (n: number) => `${sign(n)}${n.toFixed(2)}%`;
const cls = (n: number) => (n >= 0 ? "perf__pnl--green" : "perf__pnl--red");

// Did the dip strategy beat both naive baselines?
const verdict = (p: PerformancePosition) => {
  const a = p.actual.pnlPercent;
  if (a >= p.calendarDca.pnlPercent && a >= p.hold.pnlPercent) {
    return { label: "Dip strategy won", kind: "win" };
  }
  if (a <= p.calendarDca.pnlPercent && a <= p.hold.pnlPercent) {
    return { label: "Lagged benchmarks", kind: "lag" };
  }
  return { label: "Mixed result", kind: "mixed" };
};

// Bar width relative to the best leg, for a quick visual scan.
const barWidth = (value: number, p: PerformancePosition) => {
  const vals = [p.actual.valueUsdt, p.calendarDca.valueUsdt, p.hold.valueUsdt];
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals) * 0.98;
  return `${((value - min) / (max - min || 1)) * 100}%`;
};
</script>

<template>
  <section class="perf">
    <div class="perf__header">
      <div>
        <h2 class="perf__title">Strategy vs Benchmarks</h2>
        <p class="perf__subtitle">
          Same capital, same window: dip-buying against dumb daily DCA and buy-and-hold.
        </p>
      </div>
    </div>

    <p v-if="positions.length === 0" class="perf__empty">
      No simulated purchases yet — the comparison appears after the first executed dry-run order.
    </p>

    <div v-else class="perf__grid">
      <article v-for="p in positions" :key="p.symbol" class="perf__card">
        <header class="perf__card-head">
          <span class="perf__symbol">{{ p.symbol }}</span>
          <span class="perf__badge" :class="`perf__badge--${verdict(p).kind}`">
            {{ verdict(p).label }}
          </span>
        </header>

        <div class="perf__legs">
          <div class="perf__leg">
            <div class="perf__leg-top">
              <span class="perf__leg-name perf__leg-name--primary">Dip buying</span>
              <span class="perf__pnl" :class="cls(p.actual.pnlPercent)">{{ pct(p.actual.pnlPercent) }}</span>
            </div>
            <div class="perf__bar">
              <div class="perf__bar-fill perf__bar-fill--primary" :style="{ width: barWidth(p.actual.valueUsdt, p) }"></div>
            </div>
          </div>

          <div class="perf__leg">
            <div class="perf__leg-top">
              <span class="perf__leg-name">Calendar DCA</span>
              <span class="perf__pnl" :class="cls(p.calendarDca.pnlPercent)">{{ pct(p.calendarDca.pnlPercent) }}</span>
            </div>
            <div class="perf__bar">
              <div class="perf__bar-fill" :style="{ width: barWidth(p.calendarDca.valueUsdt, p) }"></div>
            </div>
          </div>

          <div class="perf__leg">
            <div class="perf__leg-top">
              <span class="perf__leg-name">Buy &amp; hold</span>
              <span class="perf__pnl" :class="cls(p.hold.pnlPercent)">{{ pct(p.hold.pnlPercent) }}</span>
            </div>
            <div class="perf__bar">
              <div class="perf__bar-fill" :style="{ width: barWidth(p.hold.valueUsdt, p) }"></div>
            </div>
          </div>
        </div>

        <footer class="perf__foot">Invested {{ p.spentUsdt.toFixed(0) }} USDT over {{ p.orders }} buys</footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.perf {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.perf__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.perf__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: var(--color-text-subtle);
}

.perf__empty {
  margin: 0;
  text-align: center;
  padding: var(--space-8) var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-subtle);
}

.perf__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr));
  gap: var(--space-4);
}

.perf__card {
  padding: var(--space-5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.perf__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.perf__symbol {
  font-weight: 800;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.perf__badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
}

.perf__badge--win {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.perf__badge--lag {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.perf__badge--mixed {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.perf__legs {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.perf__leg-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  margin-bottom: 0.35rem;
}

.perf__leg-name {
  color: var(--color-text-muted);
}

.perf__leg-name--primary {
  color: var(--color-action);
  font-weight: 700;
}

.perf__pnl {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.perf__pnl--green {
  color: var(--color-success);
}

.perf__pnl--red {
  color: var(--color-danger);
}

.perf__bar {
  height: 6px;
  border-radius: 3px;
  background: var(--color-border-subtle);
  overflow: hidden;
}

.perf__bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--color-text-subtle);
  transition: width var(--duration-medium) var(--ease-standard);
}

.perf__bar-fill--primary {
  background: var(--color-action);
}

.perf__foot {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  border-block-start: 1px solid var(--color-border-subtle);
  padding-block-start: var(--space-3);
}

@media (max-width: 36rem) {
  .perf {
    padding: var(--space-5);
  }
}
</style>
