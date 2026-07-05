<script setup lang="ts">
defineProps<{
  modelValue: string | number;
  type?: string;
  step?: string | number;
  placeholder?: string;
  disabled?: boolean;
  suffix?: string;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "input", event: Event): void;
}>();
</script>

<template>
  <div class="ui-input-container">
    <input
      :type="type || 'text'"
      :step="step"
      :placeholder="placeholder"
      :disabled="disabled"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="ui-input"
      :class="{ 'ui-input--with-suffix': suffix }"
    />
    <span v-if="suffix" class="ui-input__suffix">{{ suffix }}</span>
  </div>
</template>

<style scoped>
.ui-input-container {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
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

.ui-input--with-suffix {
  text-align: right;
  padding-right: 2.25rem !important;
}

.ui-input__suffix {
  position: absolute;
  right: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  pointer-events: none;
}
</style>
