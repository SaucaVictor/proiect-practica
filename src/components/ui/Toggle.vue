<script setup lang="ts">
interface Props {
  modelValue?: boolean
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const toggleId = props.id ?? `toggle-${Math.random().toString(36).slice(2)}`
</script>

<template>
  <div class="toggle-row">
    <div class="toggle-text">
      <label v-if="label" :for="toggleId" class="toggle-label">{{ label }}</label>
      <p v-if="description" class="toggle-desc">{{ description }}</p>
    </div>
    <button
      :id="toggleId"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="['toggle', { 'toggle--on': modelValue }]"
      type="button"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="toggle-thumb" />
    </button>
  </div>
</template>

<style scoped>
.toggle-row  { @apply flex items-center justify-between gap-4; }
.toggle-text { @apply flex flex-col gap-0.5 flex-1; }
.toggle-label { @apply text-sm font-medium text-surface-900 dark:text-surface-950 cursor-pointer; }
.toggle-desc  { @apply text-xs text-surface-600 dark:text-surface-700; }

.toggle {
  @apply relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer
         bg-surface-300 dark:bg-surface-400
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.toggle--on { @apply bg-accent-500; }

.toggle-thumb {
  @apply absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
         transition-transform duration-200;
}

.toggle--on .toggle-thumb { @apply translate-x-5; }
</style>
