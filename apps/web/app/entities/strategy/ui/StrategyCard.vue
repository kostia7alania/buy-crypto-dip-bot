<script setup lang="ts">
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

defineProps<{
  strategy: Strategy;
  isEditing: boolean;
  editForm: StrategyConfigData | null;
}>();

defineEmits<{
  (e: "toggle"): void;
  (e: "edit"): void;
  (e: "save"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <div class="strategy-card">
    <div class="strategy-card__header">
      <div>
        <h3 class="strategy-card__symbol">{{ strategy.symbol }}</h3>
        <span class="strategy-card__subtitle">{{ strategy.name }}</span>
      </div>
      <div class="strategy-card__toggle-container">
        <span class="strategy-card__toggle-label">
          {{ strategy.enabled ? 'Active' : 'Paused' }}
        </span>
        <UiSwitch
          :checked="strategy.enabled"
          @change="$emit('toggle')"
        />
      </div>
    </div>

    <!-- Configuration Fields -->
    <div class="strategy-card__config-form">
      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Dip Threshold</span>
        <div v-if="isEditing && editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="editForm.thresholdPercent"
            type="number"
            step="0.1"
            suffix="%"
          />
        </div>
        <span v-else class="strategy-card__config-value strategy-card__config-value--cyan">
          {{ strategy.config.thresholdPercent }}%
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Buy Amount</span>
        <div v-if="isEditing && editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="editForm.suggestedQuoteAmount"
            type="number"
            suffix="USDT"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ strategy.config.suggestedQuoteAmount }} USDT
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Daily Limit</span>
        <div v-if="isEditing && editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="editForm.maxDailySpendUsdt"
            type="number"
            suffix="USDT"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ strategy.config.maxDailySpendUsdt }} USDT
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Weekly Limit</span>
        <div v-if="isEditing && editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="editForm.maxWeeklySpendUsdt"
            type="number"
            suffix="USDT"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ strategy.config.maxWeeklySpendUsdt }} USDT
        </span>
      </div>

      <div class="strategy-card__config-row">
        <span class="strategy-card__config-label">Cooldown</span>
        <div v-if="isEditing && editForm" class="strategy-card__input-wrapper">
          <UiInput
            v-model="editForm.cooldownMinutes"
            type="number"
            suffix="min"
          />
        </div>
        <span v-else class="strategy-card__config-value">
          {{ strategy.config.cooldownMinutes }} min
        </span>
      </div>
    </div>

    <!-- Edit Actions -->
    <div class="strategy-card__actions">
      <div v-if="isEditing" class="strategy-card__edit-buttons">
        <button @click="$emit('save')" class="ui-button ui-button--primary ui-button--sm">Save 💾</button>
        <button @click="$emit('cancel')" class="ui-button ui-button--secondary ui-button--sm">Cancel</button>
      </div>
      <button v-else @click="$emit('edit')" class="ui-button ui-button--secondary ui-button--sm ui-button--block">
        Configure ⚙️
      </button>
    </div>
  </div>
</template>

<style scoped>
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

.strategy-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.strategy-card__symbol {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: #f8fafc;
}

.strategy-card__subtitle {
  font-size: 0.75rem;
  color: #64748b;
}

.strategy-card__toggle-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.strategy-card__toggle-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
}

.strategy-card__config-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.strategy-card__config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.strategy-card__config-label {
  color: #64748b;
  font-weight: 500;
}

.strategy-card__config-value {
  color: #cbd5e1;
  font-weight: 600;
}

.strategy-card__config-value--cyan {
  color: #67e8f9 !important;
}

.strategy-card__input-wrapper {
  max-width: 6.5rem;
}

.strategy-card__actions {
  margin-top: 0.5rem;
}

.strategy-card__edit-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
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
}

.ui-button--sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
}

.ui-button--block {
  width: 100%;
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

.ui-button--secondary {
  background: rgba(255, 255, 255, 0.04);
  color: #94a3b8;
  border-color: rgba(255, 255, 255, 0.08);
}

.ui-button--secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}
</style>
