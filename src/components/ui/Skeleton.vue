<script setup lang="ts">
interface Props {
  class?: string
  lines?: number
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

withDefaults(defineProps<Props>(), {
  lines: 1,
  rounded: 'md',
})
</script>

<template>
  <div :class="['skeleton-group', $props.class]">
    <div
      v-for="i in lines"
      :key="i"
      :class="['skeleton', `rounded-${rounded}`, { 'skeleton--short': lines > 1 && i === lines }]"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.skeleton {
  @apply h-4 bg-surface-200 dark:bg-surface-300 animate-shimmer
         bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200
         dark:from-surface-300 dark:via-surface-200 dark:to-surface-300
         bg-[length:200%_100%];
}

.skeleton--short { @apply w-3/4; }

.skeleton-group { @apply flex flex-col gap-2; }
</style>
