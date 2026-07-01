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
  </aside>
</template>

<style scoped>
.sidebar {
  @apply flex flex-col h-full bg-surface-100 dark:bg-surface-50;
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
</style>
