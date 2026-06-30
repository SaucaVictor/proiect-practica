<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  fullWidth: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  {
    'btn--loading': props.loading,
    'w-full': props.fullWidth,
  },
])
</script>

<template>
  <button
    :class="classes"
    :type="type"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading"
    :aria-busy="loading"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="btn-spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  @apply inline-flex items-center justify-center gap-2 font-medium rounded-xl
         transition-all duration-150 cursor-pointer select-none
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2
         disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98];
}

/* Sizes */
.btn--sm   { @apply h-8 px-3 text-sm; }
.btn--md   { @apply h-10 px-4 text-sm; }
.btn--lg   { @apply h-12 px-6 text-base; }
.btn--icon { @apply h-9 w-9 p-0; }

/* Variants */
.btn--primary {
  @apply bg-accent-500 text-white hover:bg-accent-600 shadow-sm;
}

.btn--secondary {
  @apply bg-surface-200 dark:bg-surface-300 text-surface-900 dark:text-surface-950
         hover:bg-surface-300 dark:hover:bg-surface-400;
}

.btn--ghost {
  @apply text-surface-700 dark:text-surface-800
         hover:bg-surface-100 dark:hover:bg-surface-200;
}

.btn--outline {
  @apply border border-surface-300 dark:border-surface-400 text-surface-800 dark:text-surface-900
         hover:bg-surface-100 dark:hover:bg-surface-200;
}

.btn--danger {
  @apply bg-red-500 text-white hover:bg-red-600;
}

/* Loading spinner */
.btn-spinner {
  @apply w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin;
}
</style>
