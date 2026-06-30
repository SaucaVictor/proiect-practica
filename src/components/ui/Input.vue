<script setup lang="ts">
import { computed, useAttrs } from 'vue'

interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  type?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()

const inputId = computed(() => props.id ?? `input-${Math.random().toString(36).slice(2)}`)
</script>

<template>
  <div class="field">
    <label v-if="label" :for="inputId" class="field-label">
      {{ label }}
      <span v-if="required" class="text-red-400 ml-0.5" aria-hidden="true">*</span>
    </label>

    <input
      :id="inputId"
      v-bind="attrs"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined"
      :class="['field-input', { 'field-input--error': error }]"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />

    <p v-if="error" :id="`${inputId}-error`" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="field-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field { @apply flex flex-col gap-1.5; }

.field-label {
  @apply text-sm font-medium text-surface-800 dark:text-surface-900;
}

.field-input {
  @apply h-10 w-full px-3 rounded-xl text-sm
         bg-surface-100 dark:bg-surface-200
         border border-surface-200 dark:border-surface-300
         text-surface-950 dark:text-surface-950
         placeholder:text-surface-600 dark:placeholder:text-surface-600
         transition-colors duration-150
         focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.field-input--error {
  @apply border-red-400 focus:ring-red-400;
}

.field-error { @apply text-xs text-red-400; }
.field-hint  { @apply text-xs text-surface-600 dark:text-surface-700; }
</style>
