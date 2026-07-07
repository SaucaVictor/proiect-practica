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

const emit = defineEmits<{
  'edit-message': [id: string]
  'regenerate': []
}>()

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
  <div class="chat-messages-wrapper">
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
          v-for="(message, index) in messages"
          :key="message.id"
          :message="message"
          :show-timestamps="settings.showTimestamps"
          :is-last-assistant="message.role === 'assistant' && index === messages.length - 1"
          class="group"
          @delete="handleDeleteMessage"
          @edit="(id) => emit('edit-message', id)"
          @regenerate="emit('regenerate')"
        />
      </TransitionGroup>

      <!-- Typing indicator (streaming but no content yet) -->
      <div v-if="isStreaming && !messages[messages.length - 1]?.content" class="typing-wrapper">
        <TypingIndicator />
      </div>
    </div>

    <!-- Scroll to bottom button (outside messages-container, so it remains fixed) -->
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
.chat-messages-wrapper {
  @apply flex-1 flex flex-col min-h-0 relative overflow-hidden;
}

.messages-container {
  @apply flex-1 overflow-y-auto overflow-x-hidden;
  scroll-behavior: smooth;
}

.messages-list {
  @apply max-w-3xl mx-auto py-6;
}

.typing-wrapper {
  @apply max-w-3xl mx-auto px-4 py-3;
}

.scroll-to-bottom-btn {
  @apply absolute bottom-2 left-1/2 -translate-x-1/2 z-10
         flex items-center justify-center w-8 h-8 rounded-full
         bg-surface-100 dark:bg-surface-200
         border border-surface-300 dark:border-surface-600
         shadow-lg
         text-surface-600 dark:text-surface-300
         hover:bg-surface-200 dark:hover:bg-surface-300
         hover:text-surface-900 dark:hover:text-surface-100
         transition-all duration-150;
}

/* Message transitions */
.message-enter-active { @apply transition-all duration-300 ease-out; }
.message-enter-from   { @apply opacity-0 translate-y-2; }

/* Fade transition */
.fade-enter-active, .fade-leave-active { @apply transition-opacity duration-200; }
.fade-enter-from, .fade-leave-to       { @apply opacity-0; }
</style>
