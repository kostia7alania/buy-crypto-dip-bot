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
  gap: 1.25rem;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}

.perf__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

.perf__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: #64748b;
}

.perf__empty {
  margin: 0;
  text-align: center;
  padding: 2rem 1rem;
  color: #64748b;
  font-style: italic;
}

.perf__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr));
  gap: 1.25rem;
}

.perf__card {
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  background: rgba(30, 41, 59, 0.25);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.perf__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.perf__symbol {
  font-weight: 800;
  color: #f8fafc;
}

.perf__badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
}

.perf__badge--win {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.perf__badge--lag {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.perf__badge--mixed {
  background: rgba(250, 204, 21, 0.15);
  color: #fde68a;
}

.perf__legs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.perf__leg-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  margin-bottom: 0.35rem;
}

.perf__leg-name {
  color: #94a3b8;
}

.perf__leg-name--primary {
  color: #67e8f9;
  font-weight: 700;
}

.perf__pnl {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.perf__pnl--green {
  color: #4ade80;
}

.perf__pnl--red {
  color: #f87171;
}

.perf__bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.perf__bar-fill {
  height: 100%;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.5);
  transition: width 0.4s;
}

.perf__bar-fill--primary {
  background: #67e8f9;
}

.perf__foot {
  font-size: 0.75rem;
  color: #64748b;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 0.75rem;
}
</style>
