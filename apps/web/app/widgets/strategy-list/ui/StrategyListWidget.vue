<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  createStrategy,
  fetchStrategies,
  type Strategy,
  type StrategyConfigData,
  updateStrategy,
} from "~/entities/strategy";

const { data: strategies, refresh: refreshStrategies } = await useAsyncData(
  "strategies",
  () => fetchStrategies(),
);

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  pollingInterval = setInterval(() => {
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
    await updateStrategy(strategyId, {
      config: {
        thresholdPercent: Number(editForm.value.thresholdPercent),
        suggestedQuoteAmount: Number(editForm.value.suggestedQuoteAmount),
        maxDailySpendUsdt: Number(editForm.value.maxDailySpendUsdt),
        maxWeeklySpendUsdt: Number(editForm.value.maxWeeklySpendUsdt),
        cooldownMinutes: Number(editForm.value.cooldownMinutes),
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
    await updateStrategy(strategy.id, {
      enabled: !strategy.enabled,
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
    await createStrategy(symbol);
    newSymbol.value = "";
    await refreshStrategies();
  } catch (error: any) {
    addError.value =
      error.statusMessage || error.message || "Failed to add strategy";
  } finally {
    isAdding.value = false;
  }
};
</script>

<template>
  <section class="strategy-list">
    <div class="strategy-list__header-actions">
      <h2 class="strategy-list__title">Active Trading Strategies</h2>
      <!-- Add Custom Pair Form inline -->
      <form @submit.prevent="addCustomPair" class="strategy-list__add-form">
        <input
          v-model="newSymbol"
          type="text"
          placeholder="e.g. LTCUSDT"
          class="ui-input strategy-list__add-input"
          required
          :disabled="isAdding"
        />
        <button type="submit" class="ui-button ui-button--primary" :disabled="isAdding">
          {{ isAdding ? 'Adding...' : 'Add Coin ➕' }}
        </button>
        <span v-if="addError" class="strategy-list__error">{{ addError }}</span>
      </form>
    </div>

    <div class="strategy-list__grid">
      <StrategyCard
        v-for="strategy in strategies"
        :key="strategy.id"
        :strategy="strategy"
        :is-editing="editingId === strategy.id"
        :edit-form="editForm"
        @toggle="toggleStrategy(strategy)"
        @edit="startEdit(strategy)"
        @save="saveEdit(strategy.id)"
        @cancel="cancelEdit"
      />
    </div>
  </section>
</template>

<style scoped>
.strategy-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}

.strategy-list__header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.strategy-list__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

.strategy-list__add-form {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.strategy-list__add-input {
  max-width: 12rem;
}

.strategy-list__error {
  color: #f87171;
  font-size: 0.8125rem;
  margin-left: 0.5rem;
}

.strategy-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.ui-input {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #f1f5f9;
  padding: 0.375rem 0.625rem;
  font-size: 0.875rem;
  width: 100%;
  transition: border-color 0.2s;
}

.ui-input:focus {
  outline: none;
  border-color: #67e8f9;
}

.ui-button {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  text-align: center;
  white-space: nowrap;
}

.ui-button--primary {
  background: rgba(103, 232, 249, 0.1);
  color: #67e8f9;
  border-color: rgba(103, 232, 249, 0.25);
}

.ui-button--primary:hover:not(:disabled) {
  background: rgba(103, 232, 249, 0.2);
  border-color: rgba(103, 232, 249, 0.4);
}
</style>
