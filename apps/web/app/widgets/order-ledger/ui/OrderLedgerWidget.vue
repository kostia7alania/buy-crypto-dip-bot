<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { fetchOrders, type Order } from "~/entities/order";
import { isUnauthenticated } from "~/shared/lib/http-error";
import { formatMoney } from "~/shared/lib/number-format";

const emit = defineEmits<{
  announce: [message: string];
}>();

const lastUpdatedAt = ref<Date | null>(null);
const loadOrders = async () => {
  const result = await fetchOrders();
  lastUpdatedAt.value = new Date();
  return result;
};

const {
  data: orders,
  error,
  status,
  refresh: refreshOrders,
} = await useAsyncData("orders", loadOrders);

const formatPrice = (value: string | null) =>
  value === null ? "Not set" : `$${formatMoney(Number(value))}`;
const statusLabel = (order: Order) => {
  if (order.status === "PENDING") return "Queued";
  if (order.status === "COMPLETED") return "Simulated";
  if (order.status === "CANCELLED") return "Canceled";
  return "Unknown";
};
const errorMessage = computed(() =>
  isUnauthenticated(error.value)
    ? "Your session is no longer authorized. Sign in again before loading private ledger data."
    : "The ledger could not be loaded. No empty or successful state is inferred.",
);
const visibleOrders = computed(() => (error.value ? [] : (orders.value ?? [])));

const retryOrders = async () => {
  await refreshOrders();
  emit(
    "announce",
    error.value
      ? "The dry-run ledger is still unavailable."
      : `${orders.value?.length ?? 0} dry-run order records loaded.`,
  );
};

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  pollingInterval = setInterval(() => {
    refreshOrders();
  }, 5000);
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});
</script>

<template>
  <section class="order-ledger">
    <h2 id="order-ledger-title" class="order-ledger__title">Dry-Run Order Ledger</h2>
    <div
      class="order-ledger__table-container"
      role="region"
      aria-labelledby="order-ledger-title"
      :aria-busy="status === 'pending'"
      tabindex="0"
    >
      <table class="order-ledger__table">
        <caption>
          Tenant-scoped local order records. Mode and state are shown separately;
          this table contains no exchange fills.
        </caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Source</th>
            <th scope="col">Mode</th>
            <th scope="col">Side</th>
            <th scope="col">Price</th>
            <th scope="col">Quote Amount</th>
            <th scope="col">Time</th>
            <th scope="col">Local state</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' && !orders">
            <td colspan="8" class="order-ledger__empty">Loading tenant ledger…</td>
          </tr>
          <tr v-else-if="error">
            <td colspan="8" class="order-ledger__empty">
              <div class="order-ledger__error">
                <span>{{ errorMessage }}</span>
                <UiButton size="compact" @click="retryOrders">
                  Retry ledger
                </UiButton>
              </div>
            </td>
          </tr>
          <tr v-else-if="!orders || orders.length === 0">
            <td colspan="8" class="order-ledger__empty">
              No local dry-run orders recorded for this account.
            </td>
          </tr>
          <tr v-for="order in visibleOrders" :key="order.id" class="order-ledger__row">
            <td class="order-ledger__symbol">{{ order.symbol }}</td>
            <td>Local engine</td>
            <td>
              <span class="order-ledger__mode">{{ order.mode }}</span>
            </td>
            <td class="order-ledger__side order-ledger__side--buy">BUY</td>
            <td>{{ formatPrice(order.price) }}</td>
            <td>{{ Number(order.quoteAmount).toFixed(2) }} USDT</td>
            <td class="order-ledger__time">
              <NuxtTime :datetime="order.createdAt" hour="2-digit" minute="2-digit" second="2-digit" />
            </td>
            <td>
              <span
                class="order-ledger__badge"
                :class="`order-ledger__badge--${order.status.toLowerCase()}`"
              >
                {{ statusLabel(order) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="order-ledger__freshness">
      Last successful refresh:
      <NuxtTime
        v-if="lastUpdatedAt"
        :datetime="lastUpdatedAt"
        hour="2-digit"
        minute="2-digit"
        second="2-digit"
      />
      <span v-else>not available</span>
    </p>
  </section>
</template>

<style scoped>
.order-ledger {
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.order-ledger__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.order-ledger__table-container {
  max-inline-size: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  scrollbar-color: var(--color-border-strong) var(--color-surface);
  overscroll-behavior-inline: contain;
}

.order-ledger__table-container:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
  box-shadow: var(--focus-ring);
}

.order-ledger__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9375rem;
  min-inline-size: 44rem;
}

.order-ledger__table caption {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: 1.5;
  text-align: start;
}

.order-ledger__table th {
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: var(--color-text-subtle);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-canvas-deep);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.order-ledger__table td {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.order-ledger__row {
  transition: background-color 0.2s;
}

.order-ledger__row:hover {
  background-color: var(--color-surface-hover);
}

.order-ledger__symbol {
  font-weight: 700;
  color: var(--color-text-primary);
}

.order-ledger__mode {
  color: var(--color-simulation);
  font-weight: 700;
}

.order-ledger__side--buy {
  color: var(--color-success);
  font-weight: 700;
}

.order-ledger__time {
  color: var(--color-text-subtle);
}

.order-ledger__badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: var(--radius-sm);
  background: var(--color-surface-strong);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-strong);
}

.order-ledger__badge--pending {
  border-color: var(--color-warning-border);
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.order-ledger__badge--cancelled {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.order-ledger__badge--completed {
  border-color: var(--color-simulation-border);
  background: var(--color-simulation-soft);
  color: var(--color-simulation);
}

.order-ledger__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-subtle);
}

.order-ledger__error {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
}

.order-ledger__freshness {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

@media (max-width: 36rem) {
  .order-ledger {
    padding: var(--space-5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .order-ledger__row {
    transition: none;
  }
}

@media (forced-colors: active) {
  .order-ledger__table-container:focus-visible {
    outline: 3px solid Highlight;
    box-shadow: none;
  }

  .order-ledger__badge {
    border-color: CanvasText;
  }
}
</style>
