<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore } from '@/stores/settings.store'
import MessageItem from './MessageItem.vue'
import TypingIndicator from './TypingIndicator.vue'
import EmptyState from './EmptyState.vue'
import { useAutoScroll } from '@/composables/useAutoScroll'
import { deleteMessage } from '@/services/supabase/messages'
import { useToast } from '@/composables/useToast'

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const { error: toastError } = useToast()

const { messages, loading, isStreaming } = storeToRefs(chatStore)
const { current: settings } = storeToRefs(settingsStore)

const containerRef = ref<HTMLElement | null>(null)
const { handleScroll, onNewContent, forceScrollToBottom, isAtBottom } = useAutoScroll(containerRef)

// Scroll to bottom when new messages arrive
watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    onNewContent()
  }
)

// Scroll on streaming tokens
watch(
  () => messages.value[messages.value.length - 1]?.content,
  async () => {
    if (!isStreaming.value) return
    await nextTick()
    onNewContent()
  }
)

// Initial scroll
watch(
  () => loading.value,
  async (val) => {
    if (!val) {
      await nextTick()
      forceScrollToBottom()
    }
  }
)

async function handleDeleteMessage(id: string) {
  try {
    await deleteMessage(id)
    chatStore.removeMessage(id)
  } catch {
    toastError('Failed to delete message')
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="messages-container"
    role="log"
    aria-label="Conversation messages"
    aria-live="polite"
    @scroll="handleScroll"
  >
    <!-- Empty state -->
    <EmptyState v-if="!loading && messages.length === 0" />

    <!-- Messages -->
    <TransitionGroup v-else tag="div" name="message" class="messages-list">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :show-timestamps="settings.showTimestamps"
        class="group"
        @delete="handleDeleteMessage"
        @edit="(id) => $emit('edit-message', id)"
      />
    </TransitionGroup>

    <!-- Typing indicator (streaming but no content yet) -->
    <div v-if="isStreaming && !messages[messages.length - 1]?.content" class="typing-wrapper">
      <TypingIndicator />
    </div>

    <!-- Scroll to bottom button -->
    <Transition name="fade">
      <button
        v-if="!isAtBottom && messages.length > 0"
        id="scroll-to-bottom"
        class="scroll-to-bottom-btn"
        aria-label="Scroll to bottom"
        @click="forceScrollToBottom"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.messages-container {
  @apply flex-1 overflow-y-auto overflow-x-hidden relative;
  scroll-behavior: smooth;
}

.messages-list {
  @apply max-w-3xl mx-auto py-6;
}

.typing-wrapper {
  @apply max-w-3xl mx-auto px-4 py-3;
}

.scroll-to-bottom-btn {
  @apply fixed bottom-24 right-6 w-9 h-9 rounded-full
         bg-surface-200 dark:bg-surface-300
         border border-surface-300 dark:border-surface-400
         shadow-lg flex items-center justify-center
         text-surface-700 dark:text-surface-700
         hover:bg-surface-300 dark:hover:bg-surface-400
         hover:text-surface-950 dark:hover:text-surface-950
         transition-all duration-150 z-10;
}

/* Message transitions */
.message-enter-active { @apply transition-all duration-300 ease-out; }
.message-enter-from   { @apply opacity-0 translate-y-2; }

/* Fade transition */
.fade-enter-active, .fade-leave-active { @apply transition-opacity duration-200; }
.fade-enter-from, .fade-leave-to       { @apply opacity-0; }
</style>
