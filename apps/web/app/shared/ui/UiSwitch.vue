<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue";

const props = defineProps<{
  checked: boolean;
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<(e: "change", value: boolean) => void>();

const input = useTemplateRef<HTMLInputElement>("input");
let restoreFocus = false;

watch(
  () => props.disabled,
  async (disabled) => {
    if (disabled) {
      restoreFocus = document.activeElement === input.value;
      return;
    }
    await nextTick();
    if (
      restoreFocus &&
      !props.disabled &&
      document.activeElement === document.body
    ) {
      input.value?.focus();
    }
    restoreFocus = false;
  },
);
</script>

<template>
  <label class="ui-switch">
    <input
      ref="input"
      type="checkbox"
      class="ui-switch__input"
      :checked="props.checked"
      :disabled="props.disabled"
      :aria-label="props.label"
      @change="emit('change', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-switch__slider"></span>
  </label>
</template>

<style scoped>
.ui-switch {
  position: relative;
  display: inline-grid;
  inline-size: 2.75rem;
  block-size: var(--control-height-compact);
  place-items: center;
}

.ui-switch__input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
}

.ui-switch__slider {
  position: relative;
  display: block;
  inline-size: 2.5rem;
  block-size: 1.375rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-strong);
  cursor: pointer;
  transition:
    background var(--duration-medium) var(--ease-standard),
    border-color var(--duration-medium) var(--ease-standard);
}

.ui-switch__slider::before {
  position: absolute;
  content: "";
  inset-block-start: 0.1875rem;
  inset-inline-start: 0.1875rem;
  inline-size: 0.875rem;
  block-size: 0.875rem;
  border-radius: 50%;
  background: var(--color-text-subtle);
  transition:
    translate var(--duration-medium) var(--ease-standard),
    background var(--duration-medium) var(--ease-standard);
}

.ui-switch__input:checked + .ui-switch__slider {
  background: var(--color-success-soft);
  border-color: var(--color-success-border);
}

.ui-switch__input:checked + .ui-switch__slider::before {
  translate: 1.125rem 0;
  background: var(--color-success);
}

.ui-switch__input:focus-visible + .ui-switch__slider {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
  box-shadow: var(--focus-ring);
}

.ui-switch__input:disabled + .ui-switch__slider {
  cursor: not-allowed;
  opacity: 0.52;
}

@media (forced-colors: active) {
  .ui-switch__slider,
  .ui-switch__input:checked + .ui-switch__slider {
    border-color: CanvasText;
    background: Canvas;
  }

  .ui-switch__slider::before {
    box-sizing: border-box;
    border: 1px solid CanvasText;
  }

  .ui-switch__input:focus-visible + .ui-switch__slider {
    outline: 3px solid Highlight;
    box-shadow: none;
  }
}
</style>
