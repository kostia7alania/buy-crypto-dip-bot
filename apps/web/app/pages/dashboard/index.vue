<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

interface RiskStatus {
  mode: string;
  liveTradingEnabled: boolean;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  orderLikeActionsRequireApproval: boolean;
}

interface Order {
  id: string;
  symbol: string;
  price: string;
  quoteAmount: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface StrategyConfigData {
  thresholdPercent: number;
  suggestedQuoteAmount: number;
  maxDailySpendUsdt: number;
  maxWeeklySpendUsdt: number;
  cooldownMinutes: number;
}

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  enabled: boolean;
  mode: string;
  config: StrategyConfigData;
}

useSeoMeta({ title: "Dashboard", robots: "noindex,nofollow" });

// Fetch data using useFetch with refresh capabilities
const { data: risk, refresh: refreshRisk } =
  await useFetch<RiskStatus>("/api/risk-status");
const { data: orders, refresh: refreshOrders } =
  await useFetch<Order[]>("/api/orders");
const { data: audit, refresh: refreshAudit } =
  await useFetch<AuditLog[]>("/api/audit");
const { data: strategies, refresh: refreshStrategies } =
  await useFetch<Strategy[]>("/api/strategies");

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  // Poll database every 5 seconds for real-time updates
  pollingInterval = setInterval(() => {
    refreshRisk();
    refreshOrders();
    refreshAudit();
    // Only refresh strategies if the user is not actively editing
    if (editingId.value === null) {
      refreshStrategies();
    }
  }, 5000);
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

// Editing state for strategy config
const editingId = ref<string | null>(null);
const editForm = ref<StrategyConfigData | null>(null);

const startEdit = (strategy: Strategy) => {
  editingId.value = strategy.id;
  editForm.value = { ...strategy.config };
};

const cancelEdit = () => {
  editingId.value = null;
  editForm.value = null;
};

const saveEdit = async (strategyId: string) => {
  if (!editForm.value) return;
  try {
    await $fetch("/api/strategies", {
      method: "PATCH",
      body: {
        id: strategyId,
        config: {
          thresholdPercent: Number(editForm.value.thresholdPercent),
          suggestedQuoteAmount: Number(editForm.value.suggestedQuoteAmount),
          maxDailySpendUsdt: Number(editForm.value.maxDailySpendUsdt),
          maxWeeklySpendUsdt: Number(editForm.value.maxWeeklySpendUsdt),
          cooldownMinutes: Number(editForm.value.cooldownMinutes),
        },
      },
    });
    editingId.value = null;
    editForm.value = null;
    await refreshStrategies();
  } catch (error: any) {
    alert(`Failed to save strategy: ${error.statusMessage || error.message}`);
  }
};

const toggleStrategy = async (strategy: Strategy) => {
  try {
    await $fetch("/api/strategies", {
      method: "PATCH",
      body: {
        id: strategy.id,
        enabled: !strategy.enabled,
      },
    });
    await refreshStrategies();
  } catch (error: any) {
    alert(`Failed to toggle strategy: ${error.statusMessage || error.message}`);
  }
};

// Add custom trading pair state
const newSymbol = ref("");
const addError = ref("");
const isAdding = ref(false);

const addCustomPair = async () => {
  addError.value = "";
  const symbol = newSymbol.value.trim().toUpperCase();
  if (!symbol) return;

  isAdding.value = true;
  try {
    await $fetch("/api/strategies", {
      method: "POST",
      body: { symbol },
    });
    newSymbol.value = "";
    await refreshStrategies();
  } catch (error: any) {
    addError.value =
      error.statusMessage || error.message || "Failed to add strategy";
  } finally {
    isAdding.value = false;
  }
};

const formatTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
};
</script>

<template>
  <section class="dashboard-shell">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-content">
        <span class="eyebrow">DCA Guard Ops</span>
        <h1>Real-time Operations</h1>
        <p class="summary">
          Monitoring the safety engine, strategy triggers, and simulated order book in real-time.
        </p>
      </div>
      <div class="status-indicator">
        <div class="pulse-dot"></div>
        <span>Live Connection Active</span>
      </div>
    </header>

    <!-- Risk Cards Grid -->
    <section class="ops-section">
      <h2 class="section-title">Risk Guard Posture</h2>
      <dl class="risk-grid">
        <div class="risk-card">
          <dt>System Mode</dt>
          <dd class="highlight-cyan">{{ risk?.mode ?? 'DRY_RUN' }}</dd>
        </div>
        <div class="risk-card">
          <dt>Live Trading Status</dt>
          <dd :class="risk?.liveTradingEnabled ? 'highlight-green' : 'highlight-red'">
            {{ risk?.liveTradingEnabled ? 'ENABLED' : 'DISABLED' }}
          </dd>
        </div>
        <div class="risk-card">
          <dt>Active Strategies</dt>
          <dd class="highlight-cyan">{{ strategies?.length ?? 0 }} Loaded</dd>
        </div>
        <div class="risk-card">
          <dt>Daily Max Spend Limit</dt>
          <dd>{{ risk?.maxDailySpendUsdt ?? 20 }} USDT</dd>
        </div>
      </dl>
    </section>

    <!-- Strategy Control Center Panel -->
    <section class="data-panel full-width-panel">
      <div class="panel-header-actions">
        <h2 class="panel-title">Active Trading Strategies</h2>
        <!-- Add Custom Pair Form inline -->
        <form @submit.prevent="addCustomPair" class="add-pair-form">
          <input
            v-model="newSymbol"
            type="text"
            placeholder="e.g. LTCUSDT"
            class="ops-input add-input"
            required
            :disabled="isAdding"
          />
          <button type="submit" class="btn btn-primary" :disabled="isAdding">
            {{ isAdding ? 'Adding...' : 'Add Coin ➕' }}
          </button>
          <span v-if="addError" class="error-badge">{{ addError }}</span>
        </form>
      </div>

      <div class="strategies-grid">
        <div v-for="strategy in strategies" :key="strategy.id" class="strategy-card">
          <div class="strategy-card-header">
            <div>
              <h3>{{ strategy.symbol }}</h3>
              <span class="strategy-subtitle">{{ strategy.name }}</span>
            </div>
            <div class="toggle-container">
              <span class="toggle-label">{{ strategy.enabled ? 'Active' : 'Paused' }}</span>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="strategy.enabled"
                  @change="toggleStrategy(strategy)"
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- Configuration Fields -->
          <div class="strategy-config-form">
            <div class="config-row">
              <span class="config-label">Dip Threshold</span>
              <div v-if="editingId === strategy.id && editForm" class="input-with-suffix">
                <input
                  v-model="editForm.thresholdPercent"
                  type="number"
                  step="0.1"
                  class="ops-input edit-input"
                />
                <span class="suffix">%</span>
              </div>
              <span v-else class="config-value highlight-cyan">
                {{ strategy.config.thresholdPercent }}%
              </span>
            </div>

            <div class="config-row">
              <span class="config-label">Buy Amount</span>
              <div v-if="editingId === strategy.id && editForm" class="input-with-suffix">
                <input
                  v-model="editForm.suggestedQuoteAmount"
                  type="number"
                  class="ops-input edit-input"
                />
                <span class="suffix">USDT</span>
              </div>
              <span v-else class="config-value">
                {{ strategy.config.suggestedQuoteAmount }} USDT
              </span>
            </div>

            <div class="config-row">
              <span class="config-label">Daily Limit</span>
              <div v-if="editingId === strategy.id && editForm" class="input-with-suffix">
                <input
                  v-model="editForm.maxDailySpendUsdt"
                  type="number"
                  class="ops-input edit-input"
                />
                <span class="suffix">USDT</span>
              </div>
              <span v-else class="config-value">
                {{ strategy.config.maxDailySpendUsdt }} USDT
              </span>
            </div>

            <div class="config-row">
              <span class="config-label">Weekly Limit</span>
              <div v-if="editingId === strategy.id && editForm" class="input-with-suffix">
                <input
                  v-model="editForm.maxWeeklySpendUsdt"
                  type="number"
                  class="ops-input edit-input"
                />
                <span class="suffix">USDT</span>
              </div>
              <span v-else class="config-value">
                {{ strategy.config.maxWeeklySpendUsdt }} USDT
              </span>
            </div>

            <div class="config-row">
              <span class="config-label">Cooldown</span>
              <div v-if="editingId === strategy.id && editForm" class="input-with-suffix">
                <input
                  v-model="editForm.cooldownMinutes"
                  type="number"
                  class="ops-input edit-input"
                />
                <span class="suffix">min</span>
              </div>
              <span v-else class="config-value">
                {{ strategy.config.cooldownMinutes }} min
              </span>
            </div>
          </div>

          <!-- Edit Actions -->
          <div class="strategy-actions">
            <div v-if="editingId === strategy.id" class="edit-buttons">
              <button @click="saveEdit(strategy.id)" class="btn btn-primary btn-sm">Save 💾</button>
              <button @click="cancelEdit" class="btn btn-secondary btn-sm">Cancel</button>
            </div>
            <button v-else @click="startEdit(strategy)" class="btn btn-secondary btn-sm btn-block">
              Configure ⚙️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Orders & Audits Layout -->
    <div class="two-column-layout">
      <!-- Order History Table -->
      <section class="data-panel">
        <h2 class="panel-title">Dry-Run Order Ledger</h2>
        <div class="table-container">
          <table class="ops-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Price</th>
                <th>Quote Amount</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!orders || orders.length === 0">
                <td colspan="6" class="empty-state">No dry-run orders executed yet. Waiting for market dips...</td>
              </tr>
              <tr v-for="order in orders" :key="order.id" class="order-row">
                <td class="symbol-col">{{ order.symbol }}</td>
                <td class="side-col buy">BUY</td>
                <td>${{ Number(order.price).toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</td>
                <td>{{ Number(order.quoteAmount).toFixed(2) }} USDT</td>
                <td class="time-col">{{ formatTime(order.createdAt) }}</td>
                <td>
                  <span class="status-badge completed">SIMULATED</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Audit Log Panel -->
      <section class="data-panel">
        <h2 class="panel-title">Audit Engine Feed</h2>
        <div class="audit-list">
          <p v-if="!audit || audit.length === 0" class="empty-state">No audit logs received yet.</p>
          <div v-for="log in audit" :key="log.id" class="audit-item">
            <header class="audit-item-header">
              <span class="audit-action" :class="log.action.toLowerCase()">
                {{ log.action }}
              </span>
              <span class="audit-time">{{ formatTime(log.createdAt) }}</span>
            </header>
            <div class="audit-payload">
              <span class="payload-text">Entity: {{ log.entityType }} ({{ log.entityId.slice(0, 8) }}...)</span>
              <pre class="json-payload">{{ JSON.stringify(log.payload, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard-shell {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding-block: 4rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-content {
  flex: 1;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: #67e8f9;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

h1 {
  margin: 0;
  font-size: 3rem;
  line-height: 1.1;
  font-weight: 800;
  background: linear-gradient(135deg, #ffffff 30%, #a5f3fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.summary {
  max-inline-size: 42rem;
  margin: 1rem 0 0;
  color: #94a3b8;
  font-size: 1.1rem;
  line-height: 1.6;
}

.status-indicator {
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

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  animation: pulse 1.6s infinite;
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

.ops-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #cbd5e1;
  letter-spacing: -0.02em;
}

.risk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1.25rem;
  margin: 0;
}

.risk-card {
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.75rem;
  background: rgba(30, 41, 59, 0.3);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.25s, transform 0.25s;
}

.risk-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
}

.risk-card dt {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.risk-card dd {
  margin: 0;
  color: #f1f5f9;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.highlight-cyan {
  color: #67e8f9 !important;
}

.highlight-green {
  color: #4ade80 !important;
}

.highlight-red {
  color: #f87171 !important;
}

.two-column-layout {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 2rem;
}

@media (max-width: 64rem) {
  .two-column-layout {
    grid-template-columns: 1fr;
  }
}

.data-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}

.panel-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.add-pair-form {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.add-input {
  max-width: 12rem;
}

.error-badge {
  color: #f87171;
  font-size: 0.8125rem;
  margin-left: 0.5rem;
}

.panel-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

/* Strategy Grid */
.strategies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.strategy-card {
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(30, 41, 59, 0.25);
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  transition: border-color 0.25s;
}

.strategy-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.strategy-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.strategy-card-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: #f8fafc;
}

.strategy-subtitle {
  font-size: 0.75rem;
  color: #64748b;
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
}

/* Toggle Switch Styling */
.switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.08);
  transition: 0.25s;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
  background-color: #64748b;
  transition: 0.25s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.3);
}

input:checked + .slider:before {
  transform: translateX(18px);
  background-color: #4ade80;
}

/* Strategy Config Form */
.strategy-config-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.config-label {
  color: #64748b;
  font-weight: 500;
}

.config-value {
  color: #cbd5e1;
  font-weight: 600;
}

.input-with-suffix {
  display: flex;
  align-items: center;
  position: relative;
  max-width: 6.5rem;
}

.edit-input {
  text-align: right;
  padding-right: 2.25rem !important;
}

.suffix {
  position: absolute;
  right: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  pointer-events: none;
}

.ops-input {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #f1f5f9;
  padding: 0.375rem 0.625rem;
  font-size: 0.875rem;
  width: 100%;
}

.ops-input:focus {
  outline: none;
  border-color: #67e8f9;
}

/* Strategy Actions */
.strategy-actions {
  margin-top: 0.5rem;
}

.edit-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.btn {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  text-align: center;
}

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
}

.btn-block {
  width: 100%;
}

.btn-primary {
  background: rgba(103, 232, 249, 0.1);
  color: #67e8f9;
  border-color: rgba(103, 232, 249, 0.25);
}

.btn-primary:hover:not(:disabled) {
  background: rgba(103, 232, 249, 0.2);
  border-color: rgba(103, 232, 249, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: #94a3b8;
  border-color: rgba(255, 255, 255, 0.08);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}

.table-container {
  overflow-x: auto;
}

.ops-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9375rem;
}

.ops-table th {
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ops-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.order-row {
  transition: background-color 0.2s;
}

.order-row:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.symbol-col {
  font-weight: 700;
  color: #f8fafc;
}

.side-col.buy {
  color: #4ade80;
  font-weight: 700;
}

.time-col {
  color: #64748b;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 4px;
}

.status-badge.completed {
  background: rgba(14, 116, 144, 0.2);
  color: #67e8f9;
  border: 1px solid rgba(103, 232, 249, 0.3);
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;
  font-style: italic;
}

/* Audit Log Styles */
.audit-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 32rem;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.audit-item {
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audit-action {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  text-transform: uppercase;
}

.audit-action.signal_approved {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.audit-action.dry_run_order_completed {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.audit-action.signal_rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.audit-time {
  font-size: 0.75rem;
  color: #64748b;
}

.payload-text {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.json-payload {
  margin: 0.5rem 0 0;
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: #cbd5e1;
  overflow-x: auto;
  max-height: 8rem;
}
</style>
