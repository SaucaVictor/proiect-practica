<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useConversationStore } from '@/stores/conversation.store'
import { useAuthStore } from '@/stores/auth.store'

const conversationStore = useConversationStore()
const authStore = useAuthStore()
const { conversations } = storeToRefs(conversationStore)
const { user } = storeToRefs(authStore)
</script>

<template>
  <div class="workspace-page">
    <div class="workspace-container">
      <h1 class="workspace-title">Workspace</h1>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ conversations.length }}</span>
          <span class="stat-label">Total conversations</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ conversations.filter(c => c.pinned).length }}</span>
          <span class="stat-label">Pinned</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ conversations.filter(c => c.archived).length }}</span>
          <span class="stat-label">Archived</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ conversations.reduce((sum, c) => sum + c.messageCount, 0) }}</span>
          <span class="stat-label">Total messages</span>
        </div>
      </div>

      <div class="workspace-info">
        <p class="text-sm text-surface-600 dark:text-surface-600">
          Signed in as <strong class="text-surface-950 dark:text-surface-950">{{ user?.email }}</strong>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace-page { @apply flex-1 overflow-y-auto; }
.workspace-container { @apply max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8; }
.workspace-title { @apply text-2xl font-bold text-surface-950 dark:text-surface-950; }

.stats-grid {
  @apply grid grid-cols-2 gap-4;
}

.stat-card {
  @apply flex flex-col gap-1 p-5 rounded-2xl
         bg-surface-100 dark:bg-surface-100
         border border-surface-200 dark:border-surface-200;
}

.stat-value { @apply text-3xl font-bold text-accent-400; }
.stat-label { @apply text-sm text-surface-600 dark:text-surface-600; }
.workspace-info { @apply mt-2; }
</style>
