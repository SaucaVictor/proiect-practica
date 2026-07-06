<script setup lang="ts">
interface Props {
  modelValue?: number
  min?: number
  max?: number
  step?: number
  label?: string
  showValue?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  min: 0,
  max: 1,
  step: 0.01,
  showValue: true,
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <div class="slider-field">
    <div v-if="label" class="slider-header">
      <span class="slider-label">{{ label }}</span>
      <span v-if="showValue" class="slider-value">{{ modelValue }}</span>
    </div>
    <input
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      type="range"
      class="slider"
      :style="{ '--progress': `${((modelValue! - min!) / (max! - min!)) * 100}%` }"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
  </div>
</template>

<style scoped>
.slider-field { @apply flex flex-col gap-2; }
.slider-header { @apply flex items-center justify-between; }
.slider-label  { @apply text-sm font-medium text-surface-800 dark:text-surface-900; }
.slider-value  { @apply text-sm font-mono text-accent-400; }

.slider {
  @apply w-full h-1.5 rounded-full appearance-none cursor-pointer
         bg-surface-300 dark:bg-surface-400
         accent-accent-500;
  
  background-image: linear-gradient(to right, theme('colors.accent.500') var(--progress, 0%), transparent var(--progress, 0%));
}
</style>
