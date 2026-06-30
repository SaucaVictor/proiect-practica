<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), { size: 'md' })
</script>

<template>
  <div :class="['spinner', `spinner--${size}`]" role="status" aria-label="Loading">
    <span class="sr-only">Loading…</span>
  </div>
</template>

<style scoped>
.spinner {
  @apply rounded-full border-2 border-surface-300 dark:border-surface-400
         border-t-accent-500 animate-spin;
}
.spinner--sm { @apply w-4 h-4; }
.spinner--md { @apply w-6 h-6; }
.spinner--lg { @apply w-8 h-8; }
</style>
