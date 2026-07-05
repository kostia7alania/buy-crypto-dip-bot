<script setup lang="ts">
defineProps<{
  checked: boolean;
}>();

defineEmits<(e: "change", value: boolean) => void>();
</script>

<template>
  <label class="ui-switch">
    <input
      type="checkbox"
      class="ui-switch__input"
      :checked="checked"
      @change="$emit('change', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-switch__slider"></span>
  </label>
</template>

<style scoped>
.ui-switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 20px;
}

.ui-switch__input {
  opacity: 0;
  width: 0;
  height: 0;
}

.ui-switch__slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.08);
  transition: 0.25s;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.ui-switch__slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
  background-color: #64748b;
  transition: 0.25s;
  border-radius: 50%;
}

.ui-switch__input:checked + .ui-switch__slider {
  background-color: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.3);
}

.ui-switch__input:checked + .ui-switch__slider:before {
  transform: translateX(18px);
  background-color: #4ade80;
}
</style>
