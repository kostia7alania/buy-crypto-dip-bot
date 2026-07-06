<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { fetchOrders } from "~/entities/order";

const { data: orders, refresh: refreshOrders } = await useAsyncData(
  "orders",
  () => fetchOrders(),
);

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
    <h2 class="order-ledger__title">Dry-Run Order Ledger</h2>
    <div class="order-ledger__table-container">
      <table class="order-ledger__table">
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
            <td colspan="6" class="order-ledger__empty">No dry-run orders executed yet. Waiting for market dips...</td>
          </tr>
          <tr v-for="order in orders" :key="order.id" class="order-ledger__row">
            <td class="order-ledger__symbol">{{ order.symbol }}</td>
            <td class="order-ledger__side order-ledger__side--buy">BUY</td>
            <td>${{ Number(order.price).toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</td>
            <td>{{ Number(order.quoteAmount).toFixed(2) }} USDT</td>
            <td class="order-ledger__time">
              <NuxtTime :datetime="order.createdAt" hour="2-digit" minute="2-digit" second="2-digit" />
            </td>
            <td>
              <span class="order-ledger__badge">SIMULATED</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.order-ledger {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}

.order-ledger__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

.order-ledger__table-container {
  overflow-x: auto;
}

.order-ledger__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9375rem;
}

.order-ledger__table th {
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.order-ledger__table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
}

.order-ledger__row {
  transition: background-color 0.2s;
}

.order-ledger__row:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.order-ledger__symbol {
  font-weight: 700;
  color: #f8fafc;
}

.order-ledger__side--buy {
  color: #4ade80;
  font-weight: 700;
}

.order-ledger__time {
  color: #64748b;
}

.order-ledger__badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 4px;
  background: rgba(14, 116, 144, 0.2);
  color: #67e8f9;
  border: 1px solid rgba(103, 232, 249, 0.3);
}

.order-ledger__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;
  font-style: italic;
}
</style>
