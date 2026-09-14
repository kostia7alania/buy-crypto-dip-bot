<script setup lang="ts">
import { ref } from "vue";
import {
  createStrategy,
  type Strategy,
  type StrategyConfigData,
  updateStrategy,
} from "~/entities/strategy";

const emit = defineEmits<{
  announce: [message: string];
  mutated: [];
}>();

const props = defineProps<{
  strategies: readonly Strategy[];
  error?: unknown;
  status?: string;
}>();

// Editing state for strategy config
const editingId = ref<string | null>(null);
const editForm = ref<StrategyConfigData | null>(null);
const togglingId = ref<string | null>(null);
const mutationStatus = ref<{
  kind: "confirmed" | "failed";
  message: string;
} | null>(null);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "statusMessage" in error &&
    typeof error.statusMessage === "string"
  ) {
    return error.statusMessage;
  }
  return fallback;
};

const startEdit = (strategy: Strategy) => {
  editingId.value = strategy.id;
  editForm.value = { ...strategy.config };
};

const cancelEdit = () => {
  editingId.value = null;
  editForm.value = null;
};

const publishMutationStatus = (
  kind: "confirmed" | "failed",
  message: string,
) => {
  mutationStatus.value = { kind, message };
  emit("announce", message);
};

const saveEdit = async (strategy: Strategy) => {
  if (!editForm.value) return;
  mutationStatus.value = null;
  try {
    await updateStrategy(strategy.id, {
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
    emit("mutated");
    publishMutationStatus(
      "confirmed",
      `${strategy.symbol} limits and threshold were saved.`,
    );
  } catch (error: unknown) {
    publishMutationStatus(
      "failed",
      `${strategy.symbol} was not saved: ${getErrorMessage(error, "Unknown error")}`,
    );
  }
};

const toggleStrategy = async (strategy: Strategy) => {
  if (togglingId.value) return;
  togglingId.value = strategy.id;
  const nextEnabled = !strategy.enabled;
  mutationStatus.value = null;
  try {
    await updateStrategy(strategy.id, {
      enabled: nextEnabled,
    });
    emit("mutated");
    publishMutationStatus(
      "confirmed",
      nextEnabled
        ? `${strategy.symbol} is active. New eligible signals may be evaluated.`
        : `${strategy.symbol} is paused. New signals stop; an existing pending DRY_RUN keeps its recorded execution time unless canceled separately.`,
    );
  } catch (error: unknown) {
    const message = getErrorMessage(
      error,
      "The strategy state was not changed.",
    );
    publishMutationStatus(
      "failed",
      `${strategy.symbol} was not updated: ${message}`,
    );
  } finally {
    togglingId.value = null;
  }
};

// Add custom trading pair state
const newSymbol = ref("");
const isAdding = ref(false);

const addCustomPair = async () => {
  mutationStatus.value = null;
  const symbol = newSymbol.value.trim().toUpperCase();
  if (!symbol) return;

  isAdding.value = true;
  try {
    await createStrategy(symbol);
    newSymbol.value = "";
    emit("mutated");
    publishMutationStatus(
      "confirmed",
      `${symbol} was added in DRY_RUN mode. Review its caps before activation.`,
    );
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Failed to add strategy");
    publishMutationStatus("failed", `${symbol} was not added: ${message}`);
  } finally {
    isAdding.value = false;
  }
};
</script>

<template>
  <section class="strategy-list">
    <p v-if="props.error" role="alert">Strategies could not be refreshed. Retry before changing limits.</p>
    <p v-else-if="props.status === 'pending' && !props.strategies.length" role="status">Loading strategies...</p>
    <div class="strategy-list__header-actions">
      <h2 class="strategy-list__title">Active Trading Strategies</h2>
      <!-- Add Custom Pair Form inline -->
      <form @submit.prevent="addCustomPair" class="strategy-list__add-form">
        <label class="strategy-list__field">
          <span>Pair symbol</span>
          <UiInput
            v-model="newSymbol"
            type="text"
            placeholder="e.g. LTCUSDT"
            class="strategy-list__add-input"
            aria-label="Trading pair symbol"
            required
            :disabled="isAdding"
          />
        </label>
        <UiButton type="submit" variant="primary" :disabled="isAdding">
          {{ isAdding ? 'Adding…' : 'Add pair' }}
        </UiButton>
      </form>
    </div>

    <p
      v-if="mutationStatus"
      class="strategy-list__mutation-status"
      :class="`strategy-list__mutation-status--${mutationStatus.kind}`"
    >
      <strong>{{ mutationStatus.kind === 'failed' ? 'Not changed:' : 'Confirmed:' }}</strong>
      {{ mutationStatus.message }}
    </p>

    <div class="strategy-list__grid">
      <StrategyCard
        v-for="strategy in props.strategies"
        :key="strategy.id"
        :strategy="strategy"
        :is-editing="editingId === strategy.id"
        :edit-form="editForm"
        :is-toggling="togglingId === strategy.id"
        @toggle="toggleStrategy(strategy)"
        @edit="startEdit(strategy)"
        @save="saveEdit(strategy)"
        @cancel="cancelEdit"
      />
    </div>
  </section>
</template>

<style scoped>
.strategy-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.strategy-list__header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.strategy-list__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.strategy-list__add-form {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.strategy-list__field {
  display: grid;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.strategy-list__add-input {
  max-inline-size: 12rem;
}

.strategy-list__mutation-status {
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-sm);
  background: var(--color-success-soft);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
}

.strategy-list__mutation-status--failed {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
}

.strategy-list__mutation-status strong {
  color: var(--color-text-primary);
}

.strategy-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: var(--space-4);
  margin-block-start: var(--space-2);
}

@media (max-width: 42rem) {
  .strategy-list {
    padding: var(--space-5);
  }

  .strategy-list__add-form {
    inline-size: 100%;
    align-items: stretch;
    flex-direction: column;
  }

  .strategy-list__add-input {
    max-inline-size: none;
  }
}

@media (forced-colors: active) {
  .strategy-list__mutation-status {
    border-color: CanvasText;
  }
}
</style>
