<script setup lang="ts">
import { computed } from "vue";

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

const props = defineProps<{
  strategy: Strategy;
  isEditing: boolean;
  editForm: StrategyConfigData | null;
  isToggling: boolean;
  toggleStatus?: { kind: "confirmed" | "failed"; message: string } | null;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "edit"): void;
  (e: "save"): void;
  (e: "cancel"): void;
}>();

const projectedMaximum = computed(() => {
  const config = props.editForm ?? props.strategy.config;
  const perBuy = Number(config.suggestedQuoteAmount);
  const cooldown = Number(config.cooldownMinutes);
  const dailyCap = Number(config.maxDailySpendUsdt);
  const weeklyCap = Number(config.maxWeeklySpendUsdt);

  if (
    !Number.isFinite(perBuy) ||
    !Number.isFinite(cooldown) ||
    !Number.isFinite(dailyCap) ||
    !Number.isFinite(weeklyCap) ||
    perBuy <= 0 ||
    cooldown <= 0 ||
    dailyCap < 0 ||
    weeklyCap < 0
  ) {
    return null;
  }

  const dailyOrderLimit = Math.min(
    Math.floor(dailyCap / perBuy),
    Math.ceil(1440 / cooldown),
  );
  const weeklyOrderLimit = Math.min(
    Math.floor(weeklyCap / perBuy),
    Math.ceil(10080 / cooldown),
  );

  return {
    dailyOrders: dailyOrderLimit,
    dailySpend: dailyOrderLimit * perBuy,
    weeklyOrders: weeklyOrderLimit,
    weeklySpend: weeklyOrderLimit * perBuy,
  };
});

const formatUsdt = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
</script>

<template>
  <div class="strategy-card">
    <div class="strategy-card__header">
      <div>
        <h3 class="strategy-card__symbol">{{ props.strategy.symbol }}</h3>
        <span class="strategy-card__subtitle">{{ props.strategy.name }}</span>
      </div>
      <div class="strategy-card__toggle-container">
        <span class="strategy-card__toggle-label">
          {{ props.isToggling ? 'Updating…' : (props.strategy.enabled ? 'Active' : 'Paused') }}
        </span>
        <UiSwitch
          :checked="props.strategy.enabled"
          :label="`${props.strategy.enabled ? 'Pause' : 'Activate'} ${props.strategy.symbol} strategy`"
          :disabled="props.isToggling"
          @change="emit('toggle')"
        />
      </div>
    </div>

    <p class="strategy-card__mode">
      Mode <strong>{{ props.strategy.mode }}</strong> · No exchange order
    </p>

    <p
      v-if="props.toggleStatus"
      class="strategy-card__toggle-status"
      :class="`strategy-card__toggle-status--${props.toggleStatus.kind}`"
      :role="props.toggleStatus.kind === 'failed' ? 'alert' : 'status'"
    >
      {{ props.toggleStatus.message }}
    </p>

    <!-- Configuration Fields -->
    <div class="strategy-card__config-form">
      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Dip Threshold</span>
        <div v-if="props.isEditing && props.editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="props.editForm.thresholdPercent"
            type="number"
            step="0.1"
            suffix="%"
            aria-label="Dip threshold percentage"
          />
        </div>
        <span v-else class="strategy-card__config-value strategy-card__config-value--cyan">
          {{ props.strategy.config.thresholdPercent }}%
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Buy Amount</span>
        <div v-if="props.isEditing && props.editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="props.editForm.suggestedQuoteAmount"
            type="number"
            suffix="USDT"
            aria-label="Suggested buy amount in USDT"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ props.strategy.config.suggestedQuoteAmount }} USDT
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Daily Limit</span>
        <div v-if="props.isEditing && props.editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="props.editForm.maxDailySpendUsdt"
            type="number"
            suffix="USDT"
            aria-label="Daily spend limit in USDT"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ props.strategy.config.maxDailySpendUsdt }} USDT
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Weekly Limit</span>
        <div v-if="props.isEditing && props.editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="props.editForm.maxWeeklySpendUsdt"
            type="number"
            suffix="USDT"
            aria-label="Weekly spend limit in USDT"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ props.strategy.config.maxWeeklySpendUsdt }} USDT
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Cooldown</span>
        <div v-if="props.isEditing && props.editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="props.editForm.cooldownMinutes"
            type="number"
            suffix="min"
            aria-label="Cooldown in minutes"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ props.strategy.config.cooldownMinutes }} min
        </span>
      </div>
    </div>

    <aside
      v-if="props.isEditing"
      class="strategy-card__preview"
    >
      <strong>Pre-save DRY_RUN preview</strong>
      <p v-if="projectedMaximum">
        At most {{ projectedMaximum.dailyOrders }} configured buys / {{
          formatUsdt(projectedMaximum.dailySpend)
        }} USDT per rolling 24h, and {{ projectedMaximum.weeklyOrders }} buys /
        {{ formatUsdt(projectedMaximum.weeklySpend) }} USDT per rolling 7d.
      </p>
      <p v-else>
        Enter positive per-buy and cooldown values plus non-negative caps to
        calculate a projection.
      </p>
      <p>
        This upper bound assumes continuously eligible signals and correctly
        operating controls. It is not a forecast or exchange-spend promise.
      </p>
    </aside>

    <!-- Edit Actions -->
    <div class="strategy-card__actions">
      <div v-if="props.isEditing" class="strategy-card__edit-buttons">
        <UiButton variant="primary" size="compact" @click="emit('save')">
          Save
        </UiButton>
        <UiButton size="compact" @click="emit('cancel')">Cancel</UiButton>
      </div>
      <UiButton v-else size="compact" block @click="emit('edit')">
        Configure
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.strategy-card {
  padding: var(--space-5);
  border: 1px solid var(--color-border-subtle);
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.strategy-card:hover {
  border-color: var(--color-border-strong);
}

.strategy-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.strategy-card__symbol {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.strategy-card__subtitle {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.strategy-card__mode {
  margin: calc(var(--space-2) * -1) 0 0;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.strategy-card__mode strong {
  color: var(--color-simulation);
}

.strategy-card__toggle-status {
  margin: calc(var(--space-2) * -1) 0 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-sm);
  background: var(--color-success-soft);
  color: var(--color-success);
  font-size: var(--text-caption);
}

.strategy-card__toggle-status--failed {
  border-color: var(--color-danger-border);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.strategy-card__toggle-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.strategy-card__toggle-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.strategy-card__config-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.strategy-card__config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.strategy-card__config-label {
  color: var(--color-text-subtle);
  font-weight: 500;
}

.strategy-card__config-value {
  color: var(--color-text-secondary);
  font-weight: 600;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.strategy-card__config-value--cyan {
  color: var(--color-action);
}

.strategy-card__input-wrapper {
  max-width: 6.5rem;
}

.strategy-card__preview {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-simulation-border);
  border-radius: var(--radius-sm);
  background: var(--color-simulation-soft);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.strategy-card__preview strong {
  color: var(--color-simulation);
}

.strategy-card__preview p {
  margin: 0;
}

.strategy-card__actions {
  margin-block-start: var(--space-2);
}

.strategy-card__edit-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
</style>
