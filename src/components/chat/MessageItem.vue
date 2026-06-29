<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '@/types'
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer.vue'
import { useClipboard } from '@/composables/useClipboard'
import { formatTime, formatFileSize } from '@/utils/format'

interface Props {
  message: Message
  showTimestamps?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTimestamps: true,
})

const emit = defineEmits<{
  delete: [id: string]
  edit: [id: string]
  copy: [content: string]
}>()

const { copy } = useClipboard()
const showReasoning = ref(false)

const isUser = computed(() => props.message.role === 'user')
const isError = computed(() => props.message.role === 'error' || props.message.status === 'error')
const isStreaming = computed(() => props.message.status === 'streaming')
const hasReasoning = computed(() => !!props.message.reasoning)

const displayContent = computed(() => {
  const raw = props.message.content
  if (!raw) return ''
  return raw.replace(/<!-- FILES_CONTENT_START -->[\s\S]*<!-- FILES_CONTENT_END -->/, '').trim()
})
</script>

<template>
  <div
    :id="`msg-${message.id}`"
    :class="['message-row', `message-row--${message.role}`]"
  >
    <!-- User message -->
    <div v-if="isUser" class="message-user">
      <div class="message-user-bubble">
        <p v-if="displayContent" class="message-user-text">{{ displayContent }}</p>

        <!-- Attachment list -->
        <div v-if="message.attachments && message.attachments.length > 0" class="msg-attachments-container">
          <div v-for="att in message.attachments" :key="att.id" class="msg-attachment-card">
            <a v-if="att.url" :href="att.url" target="_blank" class="msg-attachment-card-link">
              <img v-if="att.mimeType.startsWith('image/')" :src="att.url" class="msg-attachment-card-img" />
              <div v-else class="msg-attachment-card-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 2h5.5L13 5.5V14H4V2z" stroke="currentColor" stroke-width="1.2" />
                  <path d="M9.5 2v3.5H13" stroke="currentColor" stroke-width="1.2" />
                </svg>
              </div>
              <div class="msg-attachment-card-info">
                <span class="msg-attachment-card-name">{{ att.name }}</span>
                <span class="msg-attachment-card-size">{{ formatFileSize(att.size) }}</span>
              </div>
            </a>
            <div v-else class="msg-attachment-card-link cursor-default">
              <div class="msg-attachment-card-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 2h5.5L13 5.5V14H4V2z" stroke="currentColor" stroke-width="1.2" />
                  <path d="M9.5 2v3.5H13" stroke="currentColor" stroke-width="1.2" />
                </svg>
              </div>
              <div class="msg-attachment-card-info">
                <span class="msg-attachment-card-name">{{ att.name }}</span>
                <span class="msg-attachment-card-size">{{ formatFileSize(att.size) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showTimestamps" class="message-meta">
        <time :datetime="message.createdAt" class="message-time">
          {{ formatTime(message.createdAt) }}
        </time>
      </div>
    </div>

    <!-- Assistant / reasoning / error message -->
    <div v-else class="message-assistant">
      <!-- AI avatar -->
      <div class="message-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
          <rect width="24" height="24" rx="6" fill="#5c72f3" />
          <circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.2" fill="none" />
          <circle cx="12" cy="12" r="1.8" fill="white" />
        </svg>
      </div>

      <div class="message-assistant-content">
        <!-- Reasoning block (collapsible) -->
        <div v-if="hasReasoning" class="reasoning-block">
          <button
            class="reasoning-toggle"
            :aria-expanded="showReasoning"
            @click="showReasoning = !showReasoning"
          >
            <svg
              :class="['reasoning-chevron', { 'reasoning-chevron--open': showReasoning }]"
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              aria-hidden="true"
            >
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            <span>Reasoning</span>
            <span class="reasoning-token-count">{{ message.reasoning?.split(' ').length ?? 0 }} tokens</span>
          </button>
          <div v-if="showReasoning" class="reasoning-content">
            <MarkdownRenderer :content="message.reasoning ?? ''" />
          </div>
        </div>

        <!-- Main content -->
        <div :class="['message-body', { 'message-body--error': isError }]">
          <MarkdownRenderer v-if="message.content" :content="message.content" />

          <!-- Streaming cursor -->
          <span v-if="isStreaming && !message.content" class="streaming-cursor" aria-hidden="true" />
          <span v-if="isStreaming && message.content" class="streaming-cursor-inline" aria-hidden="true" />
        </div>

        <!-- Actions -->
        <div v-if="!isStreaming && message.content" class="message-actions">
          <button
            class="msg-action"
            aria-label="Copy message"
            title="Copy"
            @click="copy(displayContent || message.content, 'Message copied')"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.1" />
              <path d="M2 9V2.5A.5.5 0 0 1 2.5 2H9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
            </svg>
          </button>
          <button
            v-if="isUser"
            class="msg-action"
            aria-label="Edit message"
            title="Edit"
            @click="emit('edit', message.id)"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 11h1.5L9 5.5l-1.5-1.5L2 9.5V11ZM10.5 3.5l-1-1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            class="msg-action msg-action--danger"
            aria-label="Delete message"
            title="Delete"
            @click="emit('delete', message.id)"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 3h9M4.5 3V2h4v1M5.5 5.5v4M7.5 5.5v4M3 3l.5 8h6L10 3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <span v-if="showTimestamps" class="message-time ml-1">{{ formatTime(message.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  @apply px-4 py-3 animate-fade-up;
}

/* User */
.message-user {
  @apply flex flex-col items-end gap-1;
}

.message-user-bubble {
  @apply max-w-[75%] bg-accent-500 text-white rounded-2xl rounded-tr-sm px-4 py-3;
}

.message-user-text {
  @apply text-sm leading-relaxed whitespace-pre-wrap;
}

/* Assistant */
.message-assistant {
  @apply flex items-start gap-3 max-w-3xl;
}

.message-avatar {
  @apply w-7 h-7 flex-shrink-0 mt-0.5;
}

.message-assistant-content {
  @apply flex-1 min-w-0;
}

/* Reasoning */
.reasoning-block {
  @apply mb-3 rounded-lg border border-surface-300 dark:border-surface-300 overflow-hidden;
}

.reasoning-toggle {
  @apply flex items-center gap-2 w-full px-3 py-2 text-xs text-surface-600 dark:text-surface-600
         bg-surface-100 dark:bg-surface-100
         hover:bg-surface-200 dark:hover:bg-surface-200
         transition-colors duration-100;
}

.reasoning-chevron {
  @apply transition-transform duration-200;
}

.reasoning-chevron--open {
  @apply rotate-180;
}

.reasoning-token-count {
  @apply ml-auto text-surface-500 dark:text-surface-500;
}

.reasoning-content {
  @apply px-3 py-2 border-t border-surface-300 dark:border-surface-300
         text-surface-700 dark:text-surface-700 text-xs;
}

/* Message body */
.message-body { @apply text-surface-900 dark:text-surface-900; }
.message-body--error { @apply text-red-400; }

/* Streaming cursors */
.streaming-cursor {
  @apply inline-block w-2 h-4 bg-accent-400 rounded-sm animate-thinking ml-0.5 align-middle;
}
.streaming-cursor-inline {
  @apply inline-block w-0.5 h-4 bg-accent-400 animate-thinking ml-0.5 align-middle;
}

/* Actions */
.message-actions {
  @apply flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100
         transition-opacity duration-150;
}

.message-row:hover .message-actions {
  @apply opacity-100;
}

.msg-action {
  @apply flex items-center justify-center w-6 h-6 rounded-md
         text-surface-600 dark:text-surface-600
         hover:bg-surface-200 dark:hover:bg-surface-200
         hover:text-surface-950 dark:hover:text-surface-950
         transition-colors duration-100;
}

.msg-action--danger:hover {
  @apply text-red-400 bg-red-500/10;
}

.message-meta { @apply flex items-center gap-2; }
.message-time { @apply text-xs text-surface-600 dark:text-surface-600; }

.msg-attachments-container {
  @apply flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/10;
}

.msg-attachment-card {
  @apply rounded-lg bg-white/10 hover:bg-white/15 transition-colors duration-150 overflow-hidden;
}

.msg-attachment-card-link {
  @apply flex items-center gap-2.5 p-2 text-white no-underline;
}

.msg-attachment-card-img {
  @apply w-9 h-9 rounded object-cover flex-shrink-0 bg-black/20;
}

.msg-attachment-card-icon {
  @apply w-9 h-9 rounded bg-black/20 flex items-center justify-center flex-shrink-0 text-white/80;
}

.msg-attachment-card-info {
  @apply flex flex-col min-w-0;
}

.msg-attachment-card-name {
  @apply text-xs font-medium truncate max-w-[200px];
}

.msg-attachment-card-size {
  @apply text-[10px] text-white/60;
}
</style>
