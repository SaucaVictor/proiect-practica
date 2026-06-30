<script setup lang="ts">
interface Props {
  icon?: string
  title?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  icon: '✦',
  title: 'How can I help you today?',
  description: 'Start a conversation with a powerful AI model. Ask anything.',
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-icon" aria-hidden="true">{{ icon }}</div>
    <h2 class="empty-state-title">{{ title }}</h2>
    <p class="empty-state-desc">{{ description }}</p>

    <!-- Suggestion chips -->
    <div class="empty-state-suggestions">
      <slot name="suggestions" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  @apply flex flex-col items-center justify-center text-center py-16 px-4 max-w-lg mx-auto;
}

.empty-state-icon {
  @apply text-4xl mb-4 text-accent-400 animate-pulse-dot;
}

.empty-state-title {
  @apply text-2xl font-semibold text-surface-950 dark:text-surface-950 mb-3;
}

.empty-state-desc {
  @apply text-surface-700 dark:text-surface-700 text-sm leading-relaxed;
}

.empty-state-suggestions {
  @apply mt-6 flex flex-wrap gap-2 justify-center;
}
</style>
