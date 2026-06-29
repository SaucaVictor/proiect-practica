<script setup lang="ts">
import { useConversationStore } from '@/stores/conversation.store'

const conversationStore = useConversationStore()
</script>

<template>
  <div class="search-wrapper">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M6.5 11a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12l-2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <input
      id="conversation-search"
      :value="conversationStore.searchQuery"
      type="search"
      placeholder="Search conversations…"
      class="search-input"
      aria-label="Search conversations"
      @input="conversationStore.setSearch(($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.search-wrapper {
  @apply relative flex items-center;
}

.search-icon {
  @apply absolute left-3 text-surface-600 dark:text-surface-600 pointer-events-none;
}

.search-input {
  @apply w-full h-8 pl-8 pr-3 rounded-lg text-xs
         bg-surface-200 dark:bg-surface-200
         border border-transparent
         text-surface-950 dark:text-surface-950
         placeholder:text-surface-600 dark:placeholder:text-surface-600
         focus:outline-none focus:ring-1 focus:ring-accent-500
         transition-colors duration-150;
}
</style>
