<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import {
  getRunnerConnection,
  type RunnerStatusResponse,
} from "~/entities/runner";
import type { MeResponse } from "~/entities/user";

useSeoMeta({ title: "Dashboard", robots: "noindex,nofollow" });

interface SafetyStatus extends RunnerStatusResponse {
  mode?: string;
  liveTradingEnabled?: boolean;
  orderLikeActionsRequireApproval?: boolean;
}

const { data: risk, refresh: refreshRisk } = await useFetch<SafetyStatus>(
  "/api/risk-status",
  {
    key: "risk-status",
  },
);

let statusInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  statusInterval = setInterval(() => refreshRisk(), 10000);
});
onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval);
});

// Shares the `auth-me` key with TelegramLoginWidget, so both read one request.
// Panels below this line show one person's own trading data and the API now
// refuses them without a session — rendering them signed-out would produce
// empty widgets that look like "you have no orders" rather than "sign in".
const { data: me } = await useFetch<MeResponse>("/api/auth/me", {
  key: "auth-me",
});
const isSignedIn = computed(() => Boolean(me.value?.user));

const connection = computed(() => getRunnerConnection(risk.value));
const connectionNote = computed(() => {
  if (connection.value.state === "offline") {
    return "Status unavailable; the console cannot confirm new decisions";
  }
  if (connection.value.state === "stale") {
    return "Runner data is stale; verify the service before trusting it";
  }
  return "Runner status is current";
});

const operatingMode = computed(() => risk.value?.mode ?? "UNKNOWN");
const liveTrading = computed(() => {
  if (risk.value?.liveTradingEnabled === true) {
    return {
      label: "ENABLED",
      note: "Exchange funds may be affected",
      tone: "warning",
    };
  }
  if (risk.value?.liveTradingEnabled === false) {
    return {
      label: "DISABLED",
      note: "No live order execution",
      tone: "success",
    };
  }
  return {
    label: "UNKNOWN",
    note: "Runtime status is unavailable",
    tone: "offline",
  };
});
const approvalGate = computed(() => {
  if (risk.value?.orderLikeActionsRequireApproval === true) {
    return {
      label: "REQUIRED",
      note: "Order-like actions are gated",
      tone: "success",
    };
  }
  if (risk.value?.orderLikeActionsRequireApproval === false) {
    return {
      label: "BYPASSED",
      note: "Orders skip manual approval",
      tone: "warning",
    };
  }
  return {
    label: "UNKNOWN",
    note: "Approval status is unavailable",
    tone: "offline",
  };
});

const journeyAnnouncement = ref("");
const announceJourney = async (message: string) => {
  journeyAnnouncement.value = "";
  await nextTick();
  journeyAnnouncement.value = message;
};
</script>

<template>
  <section class="ops-dashboard">
    <!-- Header -->
    <header class="ops-dashboard__header">
      <div class="ops-dashboard__header-content">
        <span class="ops-dashboard__eyebrow">Safety console</span>
        <h1 class="ops-dashboard__title">Evidence before execution</h1>
        <p class="ops-dashboard__summary">
          Monitor operating mode, safety gates, strategy decisions and the
          simulated order ledger from one auditable view.
        </p>
      </div>
      <div class="ops-dashboard__header-side">
        <TelegramLoginWidget />
      </div>
    </header>

    <section class="ops-dashboard__system" aria-labelledby="system-summary-title">
      <header class="ops-dashboard__system-header">
        <div>
          <p class="ops-dashboard__system-kicker">First-read system summary</p>
          <h2 id="system-summary-title" class="ops-dashboard__system-title">
            Operating posture
          </h2>
        </div>
        <span class="ops-dashboard__system-note">
          Read each control separately
        </span>
      </header>
      <dl class="ops-dashboard__system-grid">
        <div
          class="ops-dashboard__system-item"
          :class="operatingMode === 'DRY_RUN'
            ? 'ops-dashboard__system-item--simulation'
            : 'ops-dashboard__system-item--offline'"
        >
          <dt>Operating mode</dt>
          <dd>{{ operatingMode }}</dd>
          <span>{{ operatingMode === 'DRY_RUN' ? 'Simulation is active' : 'Runtime mode is not confirmed' }}</span>
        </div>
        <div
          class="ops-dashboard__system-item"
          :class="`ops-dashboard__system-item--${liveTrading.tone}`"
        >
          <dt>Live trading</dt>
          <dd>{{ liveTrading.label }}</dd>
          <span>{{ liveTrading.note }}</span>
        </div>
        <div
          class="ops-dashboard__system-item"
          :class="`ops-dashboard__system-item--${approvalGate.tone}`"
        >
          <dt>Approval gate</dt>
          <dd>{{ approvalGate.label }}</dd>
          <span>{{ approvalGate.note }}</span>
        </div>
        <div
          class="ops-dashboard__system-item"
          :class="`ops-dashboard__system-item--${connection.state}`"
        >
          <dt>API connection</dt>
          <dd>
            <span class="ops-dashboard__connection-dot" aria-hidden="true"></span>
            {{ connection.state.toUpperCase() }}
          </dd>
          <span>{{ connectionNote }}</span>
        </div>
      </dl>
    </section>

    <!-- Risk Section — global safety posture, same for everyone -->
    <RiskGuardWidget />

    <template v-if="isSignedIn" :key="me?.user?.id">
      <p
        class="ops-dashboard__announcement"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ journeyAnnouncement }}
      </p>
      <nav class="ops-dashboard__journey-nav" aria-label="First-run proof journey">
        <p class="ops-dashboard__journey-kicker">First-run proof journey</p>
        <ol class="ops-dashboard__journey-list" role="list">
          <li>
            <a href="#proof-setup"><span>1</span>Bound pair and caps</a>
          </li>
          <li>
            <a href="#proof-decisions"><span>2</span>Read a decision</a>
          </li>
          <li>
            <a href="#proof-limitations"><span>3</span>Check limitations</a>
          </li>
          <li>
            <a href="#proof-ledger"><span>4</span>Trace the record</a>
          </li>
        </ol>
      </nav>

      <section
        id="proof-setup"
        class="ops-dashboard__journey-stage"
        aria-labelledby="proof-setup-title"
        tabindex="-1"
      >
        <header class="ops-dashboard__journey-header">
          <p class="ops-dashboard__journey-step">Step 1 · Setup and caps</p>
          <h2 id="proof-setup-title">Choose a pair, then bound the simulation</h2>
          <p>
            Configure the dip threshold, quote amount, daily and weekly caps,
            and cooldown before activation. The preview is an upper bound, not
            a forecast.
          </p>
        </header>
        <StrategyListWidget @announce="announceJourney" />
      </section>

      <section
        id="proof-decisions"
        class="ops-dashboard__journey-stage"
        aria-labelledby="proof-decisions-title"
        tabindex="-1"
      >
        <header class="ops-dashboard__journey-header">
          <p class="ops-dashboard__journey-step">Step 2 · Decision evidence</p>
          <h2 id="proof-decisions-title">Inspect what RiskGuard actually decided</h2>
          <p>
            An approved event means the recorded checks cleared. A rejected
            event means a named control stopped the proposal. An empty feed is
            not treated as either outcome.
          </p>
        </header>
        <AuditFeedWidget @announce="announceJourney" />
      </section>

      <section
        id="proof-limitations"
        class="ops-dashboard__journey-stage ops-dashboard__limitations"
        aria-labelledby="proof-limitations-title"
        tabindex="-1"
      >
        <header class="ops-dashboard__journey-header">
          <p class="ops-dashboard__journey-step">Step 3 · Evidence boundary</p>
          <h2 id="proof-limitations-title">Know what this run cannot prove</h2>
        </header>
        <ul class="ops-dashboard__limitations-list">
          <li>
            DRY_RUN creates local simulated records; it does not place or fill
            an exchange order.
          </li>
          <li>
            Fees, slippage, liquidity, private order lifecycle and exchange
            reconciliation are not reproduced here.
          </li>
          <li>
            Public market observations can be stale or unavailable. Check the
            connection and refresh evidence before interpreting a decision.
          </li>
          <li>
            Approval or rejection describes the configured controls at that
            moment; neither predicts returns.
          </li>
        </ul>
      </section>

      <section
        id="proof-ledger"
        class="ops-dashboard__journey-stage"
        aria-labelledby="proof-ledger-title"
        tabindex="-1"
      >
        <header class="ops-dashboard__journey-header">
          <p class="ops-dashboard__journey-step">Step 4 · Local ledger</p>
          <h2 id="proof-ledger-title">Trace the resulting simulated record</h2>
          <p>
            Match the pair, mode, amount, timestamp and local state. The ledger
            deliberately keeps simulation separate from an exchange fill.
          </p>
        </header>
        <OrderLedgerWidget @announce="announceJourney" />
      </section>

      <section
        class="ops-dashboard__analysis"
        aria-labelledby="extended-analysis-title"
      >
        <header class="ops-dashboard__journey-header">
          <p class="ops-dashboard__journey-step">Optional analysis</p>
          <h2 id="extended-analysis-title">Explore results after the evidence chain</h2>
          <p>
            PnL, benchmark comparisons and public-history replay add context;
            they do not upgrade a simulation into live evidence.
          </p>
        </header>
        <PnlWidget />
        <PerformanceWidget />
        <BacktestWidget />
      </section>
    </template>

    <template v-else>
      <section class="ops-dashboard__signin" aria-labelledby="signin-title">
        <p class="ops-dashboard__journey-step">First-run proof journey</p>
        <h2 id="signin-title" class="ops-dashboard__signin-title">
          Sign in to create a tenant-scoped evidence chain
        </h2>
        <p class="ops-dashboard__signin-body">
          Your bounded strategies, decisions and simulated orders belong to
          your Telegram account. Sign in with the button above, then follow the
          numbered setup → decision → limitations → ledger journey. No exchange
          API key is requested.
        </p>
      </section>

      <section class="ops-dashboard__analysis" aria-labelledby="public-replay-title">
        <header class="ops-dashboard__journey-header">
          <p class="ops-dashboard__journey-step">Available without an account</p>
          <h2 id="public-replay-title">Replay bounded rules over public history</h2>
          <p>
            This public backtest can explore a pair, threshold and quote amount.
            It does not create tenant decisions or exchange evidence.
          </p>
        </header>
        <BacktestWidget />
      </section>
    </template>
  </section>
</template>

<style scoped>
.ops-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-block: var(--space-12) var(--space-16);
}

.ops-dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-6);
  padding-block-end: var(--space-8);
  border-block-end: 1px solid var(--color-border);
}

.ops-dashboard__header-content {
  flex: 1;
  min-inline-size: min(100%, 20rem);
}

.ops-dashboard__eyebrow {
  display: block;
  margin: 0 0 var(--space-3);
  color: var(--color-action);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.ops-dashboard__title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-page-title);
  line-height: var(--line-tight);
  font-weight: 800;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.ops-dashboard__summary {
  max-inline-size: 42rem;
  margin: var(--space-4) 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-body-lg);
  line-height: var(--line-body);
}

.ops-dashboard__header-side {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.ops-dashboard__system {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-1);
}

.ops-dashboard__system-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.ops-dashboard__system-kicker {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ops-dashboard__system-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-panel-title);
  line-height: var(--line-heading);
}

.ops-dashboard__system-note {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.ops-dashboard__system-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  overflow: clip;
}

.ops-dashboard__system-item {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  min-inline-size: 0;
  padding: var(--space-4);
  background: var(--color-surface-raised);
}

.ops-dashboard__system-item:not(:last-child) {
  border-inline-end: 1px solid var(--color-border-subtle);
}

.ops-dashboard__system-item dt {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.ops-dashboard__system-item dd {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body-lg);
  font-weight: 750;
  overflow-wrap: anywhere;
}

.ops-dashboard__system-item > span {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
  line-height: 1.45;
}

.ops-dashboard__system-item--simulation dd {
  color: var(--color-simulation);
}

.ops-dashboard__system-item--success dd,
.ops-dashboard__system-item--live dd {
  color: var(--color-success);
}

.ops-dashboard__system-item--warning dd,
.ops-dashboard__system-item--stale dd {
  color: var(--color-warning);
}

.ops-dashboard__system-item--offline dd {
  color: var(--color-danger);
}

.ops-dashboard__connection-dot {
  inline-size: 0.5rem;
  block-size: 0.5rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
}

.ops-dashboard__journey-nav {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.ops-dashboard__announcement {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  clip-path: inset(50%);
  white-space: nowrap;
}

.ops-dashboard__journey-kicker,
.ops-dashboard__journey-step {
  margin: 0;
  color: var(--color-action);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ops-dashboard__journey-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ops-dashboard__journey-list a {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-block-size: var(--control-height);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  font-weight: 650;
  text-decoration: none;
}

.ops-dashboard__journey-list a:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.ops-dashboard__journey-list a:focus-visible {
  outline: 2px solid var(--color-action);
  outline-offset: 2px;
}

.ops-dashboard__journey-list span {
  display: grid;
  place-items: center;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  flex: 0 0 auto;
  border: 1px solid var(--color-simulation-border);
  border-radius: 50%;
  color: var(--color-simulation);
  font-family: var(--font-mono);
}

.ops-dashboard__journey-stage,
.ops-dashboard__analysis {
  display: grid;
  gap: var(--space-5);
  scroll-margin-block-start: var(--space-6);
}

.ops-dashboard__journey-stage:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 4px;
}

.ops-dashboard__journey-header {
  display: grid;
  gap: var(--space-2);
  max-inline-size: 54rem;
}

.ops-dashboard__journey-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-panel-title);
  line-height: var(--line-heading);
}

.ops-dashboard__journey-header > p:last-child {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: var(--line-body);
}

.ops-dashboard__limitations {
  padding: var(--space-6);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-lg);
  background: var(--color-warning-soft);
}

.ops-dashboard__limitations-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-8);
  margin: 0;
  padding-inline-start: var(--space-5);
  color: var(--color-text-secondary);
  line-height: var(--line-body);
}

/* Signed-out state for the owned panels. The design system asks empty states
   to use a dashed keyline and to say what has to happen before data appears. */
.ops-dashboard__signin {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.ops-dashboard__signin-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-panel-title);
  line-height: var(--line-heading);
}

.ops-dashboard__signin-body {
  margin: 0;
  max-width: 60ch;
  color: var(--color-text-secondary);
}

@media (max-width: 64rem) {
  .ops-dashboard__system-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ops-dashboard__system-item:nth-child(2) {
    border-inline-end: 0;
  }

  .ops-dashboard__system-item:nth-child(-n + 2) {
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .ops-dashboard__journey-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 36rem) {
  .ops-dashboard {
    gap: var(--space-8);
    padding-block-start: var(--space-10);
  }

  .ops-dashboard__system-header {
    align-items: start;
    flex-direction: column;
  }

  .ops-dashboard__system-grid {
    grid-template-columns: 1fr;
  }

  .ops-dashboard__system-item:not(:last-child) {
    border-inline-end: 0;
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .ops-dashboard__journey-list,
  .ops-dashboard__limitations-list {
    grid-template-columns: 1fr;
  }

  .ops-dashboard__limitations {
    padding: var(--space-5);
  }
}

@media (forced-colors: active) {
  .ops-dashboard__journey-list span,
  .ops-dashboard__limitations {
    border-color: CanvasText;
  }

  .ops-dashboard__journey-stage:focus-visible {
    outline: 3px solid Highlight;
  }
}
</style>
