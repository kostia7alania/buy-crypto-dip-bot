<script setup lang="ts">
import { computed, ref } from "vue";
import type { BacktestReport } from "~/entities/backtest";
import { runBacktest } from "~/entities/backtest";
import { formatMoney } from "~/shared/lib/number-format";

const symbol = ref("BTCUSDT");
const days = ref(30);
const threshold = ref(1.5);
const amount = ref(20);

const report = ref<BacktestReport | null>(null);
const loading = ref(false);
const error = ref("");

const getStatusMessage = (caught: unknown): string | undefined => {
  if (
    typeof caught !== "object" ||
    caught === null ||
    !("statusMessage" in caught)
  ) {
    return undefined;
  }

  return typeof caught.statusMessage === "string"
    ? caught.statusMessage
    : undefined;
};

const run = async () => {
  loading.value = true;
  error.value = "";
  try {
    report.value = await runBacktest({
      symbol: symbol.value.trim().toUpperCase(),
      days: days.value,
      threshold: threshold.value,
      amount: amount.value,
    });
  } catch (caught) {
    report.value = null;
    error.value =
      getStatusMessage(caught) === "NOT_ENOUGH_HISTORY"
        ? "Not enough price history for this pair."
        : "Backtest failed — check the symbol and try again.";
  } finally {
    loading.value = false;
  }
};

const money = (value: number) => formatMoney(value);
const sign = (n: number) => (n >= 0 ? "+" : "");
const pnlClass = (n: number) => (n >= 0 ? "bt__green" : "bt__red");

const verdict = computed(() => {
  const b = report.value?.benchmarks;
  if (!b) return null;
  const beatsDca = b.actual.pnlPercent > b.calendarDca.pnlPercent;
  const beatsHold = b.actual.pnlPercent > b.hold.pnlPercent;
  if (beatsDca && beatsHold)
    return {
      cls: "bt__green",
      text: "Dip-buying beat both benchmarks on this window.",
    };
  if (!beatsDca && !beatsHold)
    return {
      cls: "bt__red",
      text: "Dip-buying lagged both benchmarks on this window.",
    };
  return {
    cls: "bt__mixed",
    text: beatsDca
      ? "Beat calendar DCA, lagged buy-and-hold."
      : "Beat buy-and-hold, lagged calendar DCA.",
  };
});
</script>

<template>
  <section class="bt">
    <div class="bt__header">
      <h2 class="bt__title">Backtest the strategy</h2>
      <p class="bt__hint">
        Replay the exact dip-buying rules over real Bybit history — before
        trusting them with anything.
      </p>
    </div>

    <form class="bt__form" @submit.prevent="run">
      <label class="bt__field">
        <span>Pair</span>
        <input v-model="symbol" type="text" class="bt__input" required />
      </label>
      <label class="bt__field">
        <span>Window</span>
        <select v-model.number="days" class="bt__input">
          <option :value="14">14 days</option>
          <option :value="30">30 days</option>
          <option :value="60">60 days</option>
          <option :value="90">90 days</option>
          <option :value="120">120 days</option>
        </select>
      </label>
      <label class="bt__field">
        <span>Dip threshold %</span>
        <input v-model.number="threshold" type="number" step="0.1" min="0.1" max="50" class="bt__input" required />
      </label>
      <label class="bt__field">
        <span>Buy amount USDT</span>
        <input v-model.number="amount" type="number" min="1" class="bt__input" required />
      </label>
      <UiButton type="submit" variant="primary" :disabled="loading">
        {{ loading ? "Replaying…" : "Run backtest" }}
      </UiButton>
    </form>

    <p v-if="error" class="bt__error">{{ error }}</p>

    <div v-if="report" class="bt__result">
      <div class="bt__stats">
        <div class="bt__stat">
          <dt>Simulated buys</dt>
          <dd class="tabular">{{ report.tradeCount }}</dd>
        </div>
        <div class="bt__stat">
          <dt>Invested</dt>
          <dd class="tabular">{{ money(report.spentUsdt) }} USDT</dd>
        </div>
        <div class="bt__stat">
          <dt>Value at window end</dt>
          <dd class="tabular">{{ money(report.valueUsdt) }} USDT</dd>
        </div>
        <div class="bt__stat">
          <dt>Result</dt>
          <dd class="tabular" :class="pnlClass(report.pnlUsdt)">
            {{ sign(report.pnlUsdt) }}{{ money(report.pnlUsdt) }} USDT
            ({{ sign(report.pnlPercent) }}{{ report.pnlPercent.toFixed(2) }}%)
          </dd>
        </div>
      </div>

      <div v-if="report.benchmarks" class="bt__bench">
        <div class="bt__bench-row">
          <span>This strategy</span>
          <strong class="tabular" :class="pnlClass(report.benchmarks.actual.pnlPercent)">
            {{ sign(report.benchmarks.actual.pnlPercent) }}{{ report.benchmarks.actual.pnlPercent.toFixed(2) }}%
          </strong>
        </div>
        <div class="bt__bench-row">
          <span>Calendar DCA, same budget</span>
          <strong class="tabular" :class="pnlClass(report.benchmarks.calendarDca.pnlPercent)">
            {{ sign(report.benchmarks.calendarDca.pnlPercent) }}{{ report.benchmarks.calendarDca.pnlPercent.toFixed(2) }}%
          </strong>
        </div>
        <div class="bt__bench-row">
          <span>Buy &amp; hold from day one</span>
          <strong class="tabular" :class="pnlClass(report.benchmarks.hold.pnlPercent)">
            {{ sign(report.benchmarks.hold.pnlPercent) }}{{ report.benchmarks.hold.pnlPercent.toFixed(2) }}%
          </strong>
        </div>
        <p v-if="verdict" class="bt__verdict" :class="verdict.cls">
          {{ verdict.text }}
        </p>
      </div>

      <p class="bt__disclaimer">
        Past performance doesn't predict the future — a backtest can't see the
        next regime change. Use it to understand the strategy, not to promise
        returns.
      </p>
    </div>
  </section>
</template>

<style scoped>
.bt {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.bt__header {
  display: grid;
  gap: 0.35rem;
}

.bt__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.bt__hint {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: var(--text-small);
}

.bt__form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  align-items: end;
}

.bt__field {
  display: grid;
  gap: 0.3rem;
  font-size: var(--text-tiny);
  color: var(--text-4);
}

.bt__input {
  min-block-size: var(--control-height);
  background: var(--color-canvas-deep);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  padding-inline: var(--space-3);
  font-size: var(--text-small);
  inline-size: 9rem;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.bt__input:focus-visible {
  border-color: var(--color-action);
  background: var(--color-surface);
}

.bt__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-small);
}

.bt__result {
  display: grid;
  gap: 1.1rem;
}

.bt__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(11rem, 100%), 1fr));
  gap: 0.9rem;
}

.bt__stat {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.bt__stat dt {
  color: var(--color-text-subtle);
  font-size: var(--text-tiny);
}

.bt__stat dd {
  margin: 0;
  color: var(--color-text-primary);
  font-weight: 700;
}

.bt__bench {
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.bt__bench-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.bt__verdict {
  margin: 0.4rem 0 0;
  font-weight: 650;
  font-size: var(--text-small);
}

.bt__stat .bt__green,
.bt__bench .bt__green,
.bt__verdict.bt__green {
  color: var(--color-success);
}

.bt__stat .bt__red,
.bt__bench .bt__red,
.bt__verdict.bt__red {
  color: var(--color-danger);
}

.bt__stat .bt__mixed,
.bt__bench .bt__mixed,
.bt__verdict.bt__mixed {
  color: var(--color-warning);
}

.bt__disclaimer {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: var(--text-tiny);
  line-height: 1.5;
}

@media (max-width: 36rem) {
  .bt {
    padding: var(--space-5);
  }

  .bt__field,
  .bt__input {
    inline-size: 100%;
  }
}
</style>
