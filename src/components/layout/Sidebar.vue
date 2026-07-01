<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useConversationStore } from '@/stores/conversation.store'
import { useAuthStore } from '@/stores/auth.store'
import { subscribeToConversations, unsubscribe } from '@/services/supabase/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'
import ConversationList from '@/components/conversation/ConversationList.vue'
import ConversationSearch from '@/components/conversation/ConversationSearch.vue'
import Avatar from '@/components/ui/Avatar.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const conversationStore = useConversationStore()
const authStore = useAuthStore()

const { user } = storeToRefs(authStore)

let realtimeChannel: RealtimeChannel | null = null

onMounted(async () => {
  await conversationStore.load()

  if (user.value) {
    realtimeChannel = subscribeToConversations(user.value.id, {
      onInsert: (data) => conversationStore.upsertFromRealtime(data),
      onUpdate: (data) => conversationStore.upsertFromRealtime(data),
      onDelete: (id) => conversationStore.removeFromRealtime(id),
    })
  }
})

onUnmounted(() => {
  if (realtimeChannel) unsubscribe(realtimeChannel)
})

async function startNewChat() {
  await router.push({ name: 'chat' })
  emit('close')
}
</script>

<template>
  <aside class="sidebar" aria-label="Conversations">
    <!-- Header -->
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <svg class="sidebar-logo-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#5c72f3" />
          <circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.2" fill="none" />
          <circle cx="12" cy="12" r="1.8" fill="white" />
        </svg>
        <span class="sidebar-logo-text">NeuralChat</span>
      </div>

      <button
        id="new-chat-btn"
        class="new-chat-btn"
        title="New conversation (Ctrl+Shift+O)"
        aria-label="New conversation"
        @click="startNewChat"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Search -->
    <div class="sidebar-search">
      <ConversationSearch />
    </div>

    <!-- Conversation list -->
    <div class="sidebar-body">
      <ConversationList @close="emit('close')" />
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <ThemeToggle />

      <router-link
        :to="{ name: 'iot' }"
        class="sidebar-footer-link"
        title="IoT Dashboard"
        aria-label="IoT Dashboard"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      </router-link>

      <router-link
        :to="{ name: 'settings' }"
        class="sidebar-footer-link"
        title="Settings"
        aria-label="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" stroke="currentColor" stroke-width="1.3" />
          <path d="M14.6 9a5.6 5.6 0 0 0-.05-.6l1.3-1.02a.75.75 0 0 0 .16-.96l-1.25-2.16a.75.75 0 0 0-.92-.33l-1.52.61a5.6 5.6 0 0 0-1.04-.6L11.1 2.5a.75.75 0 0 0-.75-.65H8.65a.75.75 0 0 0-.75.65l-.23 1.44a5.6 5.6 0 0 0-1.04.6l-1.52-.61a.75.75 0 0 0-.92.33L2.94 6.42a.75.75 0 0 0 .16.96L4.4 8.4A5.6 5.6 0 0 0 4.35 9a5.6 5.6 0 0 0 .05.6L3.1 10.62a.75.75 0 0 0-.16.96l1.25 2.16c.18.32.56.46.92.33l1.52-.61c.32.22.67.41 1.04.6l.23 1.44c.08.37.39.65.75.65h2.5c.36 0 .67-.28.75-.65l.23-1.44c.37-.19.72-.38 1.04-.6l1.52.61c.36.13.74 0 .92-.33l1.25-2.16a.75.75 0 0 0-.16-.96L14.6 9.6A5.6 5.6 0 0 0 14.6 9Z" stroke="currentColor" stroke-width="1.3" />
        </svg>
      </router-link>

      <router-link :to="{ name: 'profile' }" class="sidebar-user" :aria-label="`Profile: ${user?.displayName}`">
        <Avatar :name="user?.displayName ?? user?.email ?? 'User'" :src="user?.avatarUrl ?? undefined" size="sm" />
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{{ user?.displayName ?? 'User' }}</span>
          <span class="sidebar-user-email">{{ user?.email }}</span>
        </div>
      </router-link>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  @apply flex flex-col h-full bg-surface-100 dark:bg-surface-50 border-r border-surface-200 dark:border-surface-200;
}

.sidebar-header {
  @apply flex items-center justify-between px-4 py-4 flex-shrink-0;
}

.sidebar-logo {
  @apply flex items-center gap-2.5;
}

.sidebar-logo-icon { @apply w-7 h-7; }
.sidebar-logo-text { @apply text-base font-semibold text-surface-950 dark:text-surface-950 tracking-tight; }

.new-chat-btn {
  @apply flex items-center justify-center w-8 h-8 rounded-lg
         text-surface-600 dark:text-surface-700
         hover:bg-surface-200 dark:hover:bg-surface-200
         hover:text-surface-950 dark:hover:text-surface-950
         transition-colors duration-150;
}

.sidebar-search {
  @apply px-3 pb-3 flex-shrink-0;
}

.sidebar-body {
  @apply flex-1 overflow-y-auto overflow-x-hidden;
}

.sidebar-footer {
  @apply flex items-center gap-2 px-3 py-3 border-t border-surface-200 dark:border-surface-200 flex-shrink-0;
}

.sidebar-footer-link {
  @apply flex items-center justify-center w-8 h-8 rounded-lg
         text-surface-600 dark:text-surface-700
         hover:bg-surface-200 dark:hover:bg-surface-200
         hover:text-surface-950 dark:hover:text-surface-950
         transition-colors duration-150;
}

.sidebar-user {
  @apply flex items-center gap-2.5 flex-1 min-w-0 rounded-lg p-1.5
         hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors duration-150;
}

.sidebar-user-info {
  @apply flex flex-col min-w-0;
}

.sidebar-user-name  { @apply text-xs font-medium text-surface-900 dark:text-surface-950 truncate; }
.sidebar-user-email { @apply text-xs text-surface-600 dark:text-surface-600 truncate; }
</style>
