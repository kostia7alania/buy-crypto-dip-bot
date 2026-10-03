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
        : getStatusMessage(caught) === "INVALID_HISTORY"
          ? "Price history is invalid or not chronological. No result is available."
          : "Backtest failed. Check the symbol and try again.";
  } finally {
    loading.value = false;
  }
};

const money = (value: number) => formatMoney(value);
const sign = (n: number) => (n >= 0 ? "+" : "");
const pnlClass = (n: number) => (n >= 0 ? "bt__green" : "bt__red");

const time = (value: number | string | null | undefined) => {
  const date = value == null ? null : new Date(value);
  return date && Number.isFinite(date.getTime())
    ? date.toISOString()
    : "Unavailable";
};

const historyIssueText = {
  SHORT_HISTORY: "Fewer candles returned than requested.",
  MISSING_HOURS: "There are missing hours within the consumed history.",
  INVALID_CANDLES: "Invalid candle prices are present.",
  IRREGULAR_TIMESTAMPS:
    "Hourly timestamps are invalid, duplicated or out of order.",
  UNCONFIRMED_CLOSE:
    "Some candles were not closed at the original source time; their close prices are provisional.",
  STALE_HISTORY: "The latest closed hour at the source time is missing.",
  UNKNOWN_SOURCE_TIME:
    "Source time is unavailable; candle closure cannot be confirmed.",
} satisfies Record<BacktestReport["history"]["issues"][number], string>;

const historyIssues = computed(() =>
  (report.value?.history?.issues ?? []).map((issue) => historyIssueText[issue]),
);
</script>

<template>
  <section class="bt">
    <div class="bt__header">
      <h2 class="bt__title">Backtest the strategy</h2>
      <p class="bt__hint">
        Hourly-price simulation using Bybit spot history. Not a simulation of
        live fills.
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
      <div v-if="report.history" class="bt__history">
        <p class="bt__history-line">
          {{ report.symbol }}: requested {{ report.days }} days.
          <strong :class="{ 'bt__warning': report.history.status !== 'COMPLETE' }">
            {{ report.history.status === 'COMPLETE' ? 'Continuous, closed hourly input at source time.' : 'Incomplete history. Results are provisional.' }}
          </strong>
        </p>
        <p class="bt__history-line">
          Consumed input (candle-open timestamps, UTC):
          {{ time(report.history.inputStartAt) }} to {{ time(report.history.inputEndAt) }}.
        </p>
        <p class="bt__history-line">
          Actual replay (candle-open timestamps, UTC):
          {{ time(report.history.replayStartAt) }} to {{ time(report.history.replayEndAt) }}.
          Prices use each candle's close field, not its opening price.
        </p>
        <p class="bt__history-line">
          {{ report.history.receivedCandles }} / {{ report.history.expectedCandles }} requested candles:
          {{ report.history.warmupCandles }} warm-up + {{ report.history.replayCandles }} replay.
          Missing hours between records: {{ report.history.missingHours }}.
          Unconfirmed candles: {{ report.history.unconfirmedCandles }}.
        </p>
        <ul v-if="historyIssues.length" class="bt__issues bt__warning">
          <li v-for="issue in historyIssues" :key="issue">{{ issue }}</li>
        </ul>
      </div>
      <p v-else class="bt__history-line bt__warning">
        History completeness is unavailable. Do not treat this as a full selected window.
      </p>
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
          <dt>Value at last supplied price</dt>
          <dd class="tabular">{{ money(report.valueUsdt) }} USDT</dd>
        </div>
        <div class="bt__stat">
          <dt>PnL before costs</dt>
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
          <span>DCA, equal total capital</span>
          <strong class="tabular" :class="pnlClass(report.benchmarks.calendarDca.pnlPercent)">
            {{ sign(report.benchmarks.calendarDca.pnlPercent) }}{{ report.benchmarks.calendarDca.pnlPercent.toFixed(2) }}%
          </strong>
        </div>
        <div class="bt__bench-row">
          <span>Hold, equal total capital</span>
          <strong class="tabular" :class="pnlClass(report.benchmarks.hold.pnlPercent)">
            {{ sign(report.benchmarks.hold.pnlPercent) }}{{ report.benchmarks.hold.pnlPercent.toFixed(2) }}%
          </strong>
        </div>
        <p class="bt__disclaimer">
          Equal total spend, different investment times. These are not matched
          cash flows or evidence of an investable advantage.
        </p>
      </div>

      <details v-if="report.methodology && report.provenance" class="bt__methodology">
        <summary class="bt__summary">Calculation method and data provenance</summary>
        <dl class="bt__definitions">
          <div>
            <dt class="bt__term">Dip replay</dt>
            <dd class="bt__definition">
              After 24 warm-up records, compare each hourly close field with
              the highest high in the previous 24 records, excluding the current
              candle. Buy {{ money(report.config.buyAmountUsdt) }} USDT when the
              drop reaches {{ report.config.thresholdPercent }}%, subject to a
              {{ report.config.cooldownMinutes }}-minute cooldown and rolling
              24-hour / 7-day caps of {{ money(report.config.maxDailySpendUsdt) }} /
              {{ money(report.config.maxWeeklySpendUsdt) }} USDT. Trades and cap
              cutoffs use candle-open timestamps. Intrahour signals and fills
              are not replayed.
            </dd>
          </div>
          <div>
            <dt class="bt__term">Capital schedule</dt>
            <dd class="bt__definition">
              Each benchmark uses the dip strategy's total simulated spend,
              {{ money(report.methodology.benchmarkCapitalUsdt) }} USDT, known
              only after the replay. Hold invests it all at the close field of
              the first replay candle. DCA divides it equally across every 24th
              replay record, starting with that same candle, not UTC daily closes.
              <template v-if="report.benchmarks && report.methodology.dcaAmountUsdt !== null">
                {{ report.methodology.benchmarkSampleTimes.length }} DCA buys of
                {{ money(report.methodology.dcaAmountUsdt) }} USDT each (rounded for display),
                from {{ time(report.methodology.benchmarkSampleTimes[0]) }} to
                {{ time(report.methodology.benchmarkSampleTimes.at(-1)) }}
                (candle-open timestamps, UTC).
              </template>
              No capital-availability schedule is modelled; benchmark purchases
              do not inherit the dip strategy's cooldown or spending caps.
            </dd>
          </div>
          <div>
            <dt class="bt__term">Value and PnL</dt>
            <dd class="bt__definition">
              Value = accumulated quantity × last supplied close field.
              PnL = value − total simulated spend; PnL % = PnL / spend × 100.
              This is an unrealized return on deployed capital, not an annualized,
              time-weighted or money-weighted return. Unspent cash and its return
              are excluded. With no buys, PnL is shown as zero and benchmarks are
              unavailable. Fees and slippage are not modelled.
            </dd>
          </div>
          <div>
            <dt class="bt__term">Missing and provisional data</dt>
            <dd class="bt__definition">
              The request targets days × 24 + 25 candles: 24 for warm-up, then
              replay samples including both endpoints. Missing hours are not
              filled or interpolated. Short or gappy history is replayed as
              supplied and marked incomplete; 24 records may span more than
              24 hours. Invalid prices or irregular timestamps prevent a result.
              An unconfirmed candle is retained with its provisional close
              field and marked incomplete, even if it has since aged in cache.
              Completeness applies to the original source snapshot, not live data.
            </dd>
          </div>
          <div>
            <dt class="bt__term">Source and cache</dt>
            <dd class="bt__definition">
              Bybit spot, 60-minute candles. Fetched {{ time(report.provenance.fetchedAt) }}.
              {{ report.provenance.cacheHit ? 'Cached response' : 'Fetched for this run' }};
              cache age {{ Math.round(report.provenance.cacheAgeMs / 1000) }} seconds,
              TTL {{ report.provenance.cacheTtlMs / 60000 }} minutes.
              Closure is checked against the earliest source/receipt clock across
              all pages. These timestamps are preserved on cache reads.
              <ul class="bt__sources">
                <li v-for="(page, index) in report.provenance.pages" :key="index">
                  Page {{ index + 1 }}: source {{ time(page.sourceAt) }},
                  received {{ time(page.receivedAt) }}.
                </li>
              </ul>
            </dd>
          </div>
        </dl>
      </details>

      <p class="bt__disclaimer">
        Fees and slippage are not modelled. Historical simulation, not an
        investment recommendation or a forecast. Past performance does not
        predict future returns.
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

.bt__history {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-small);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.bt__history-line {
  margin: 0;
  overflow-wrap: anywhere;
}

.bt__warning {
  color: var(--color-warning);
}

.bt__issues,
.bt__sources {
  margin: 0;
  padding-inline-start: var(--space-5);
}

.bt__methodology {
  padding-block: var(--space-3);
  border-block: 1px solid var(--color-border-subtle);
  font-size: var(--text-small);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.bt__summary {
  cursor: pointer;
  color: var(--color-text-primary);
  font-weight: 650;
}

.bt__definitions {
  display: grid;
  gap: var(--space-4);
  margin-block: var(--space-4) 0;
}

.bt__term {
  color: var(--color-text-primary);
  font-weight: 650;
}

.bt__definition {
  margin: 0;
  color: var(--color-text-muted);
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

.bt__stat .bt__green,
.bt__bench .bt__green {
  color: var(--color-success);
}

.bt__stat .bt__red,
.bt__bench .bt__red {
  color: var(--color-danger);
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
