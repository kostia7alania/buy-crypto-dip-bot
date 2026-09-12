<script setup lang="ts">
const props = defineProps<{
  modelValue: string | number;
  type?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  suffix?: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "input", event: Event): void;
}>();
</script>

<template>
  <div class="ui-input-container">
    <input
      :type="props.type || 'text'"
      :step="props.step"
      :min="props.min"
      :max="props.max"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :required="props.required"
      :aria-label="props.ariaLabel"
      :value="props.modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="ui-input"
      :class="{ 'ui-input--with-suffix': props.suffix }"
    />
    <span v-if="props.suffix" class="ui-input__suffix">{{ props.suffix }}</span>
  </div>
</template>

<style scoped>
.ui-input-container {
  position: relative;
  display: flex;
  align-items: center;
  inline-size: 100%;
}

.ui-input {
  min-block-size: var(--control-height-compact);
  inline-size: 100%;
  padding-inline: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  background: var(--color-canvas-deep);
  font-family: var(--font-mono);
  font-size: var(--text-small);
  font-variant-numeric: tabular-nums;
  transition:
    background var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.ui-input:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}

.ui-input:focus-visible {
  border-color: var(--color-action);
  background: var(--color-surface);
}

.ui-input:disabled {
  color: var(--color-text-subtle);
  background: var(--color-surface);
}

.ui-input--with-suffix {
  text-align: right;
  padding-inline-end: 2.75rem;
}

.ui-input__suffix {
  position: absolute;
  inset-inline-end: var(--space-3);
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  pointer-events: none;
}
</style>
