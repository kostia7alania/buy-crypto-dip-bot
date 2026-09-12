<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary";
    size?: "default" | "compact";
    block?: boolean;
    disabled?: boolean;
  }>(),
  {
    type: "button",
    variant: "secondary",
    size: "default",
    block: false,
    disabled: false,
  },
);

const emit = defineEmits<(e: "click", event: MouseEvent) => void>();
</script>

<template>
  <button
    :type="props.type"
    class="ui-button"
    :class="[
      `ui-button--${props.variant}`,
      `ui-button--${props.size}`,
      { 'ui-button--block': props.block },
    ]"
    :disabled="props.disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.ui-button {
  min-block-size: var(--control-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding-inline: var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-small);
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    background var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    translate var(--duration-fast) var(--ease-standard);
}

.ui-button:hover:not(:disabled) {
  translate: 0 -1px;
}

.ui-button:active:not(:disabled) {
  translate: 0 0;
}

.ui-button--primary {
  color: var(--color-canvas-deep);
  background: var(--color-action);
  border-color: var(--color-action);
}

.ui-button--primary:hover:not(:disabled) {
  background: var(--color-action-strong);
  border-color: var(--color-action-strong);
}

.ui-button--secondary {
  color: var(--color-text-secondary);
  background: var(--color-surface-raised);
  border-color: var(--color-border);
}

.ui-button--secondary:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}

.ui-button--compact {
  min-block-size: var(--control-height-compact);
  padding-inline: var(--space-3);
  font-size: var(--text-caption);
}

.ui-button--block {
  inline-size: 100%;
}

@media (forced-colors: active) {
  .ui-button {
    border-color: ButtonText;
  }
}
</style>
