<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useConversationStore } from '@/stores/conversation.store'
import type { Conversation } from '@/types'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{ close: [] }>()

const route = useRoute()
const router = useRouter()
const conversationStore = useConversationStore()
const { success, error: toastError } = useToast()

const { grouped, loading } = storeToRefs(conversationStore)

const editingId = ref<string | null>(null)
const editingTitle = ref('')

function isActive(id: string) {
  return route.params['id'] === id
}

function startEdit(conv: Conversation, event: Event) {
  event.stopPropagation()
  editingId.value = conv.id
  editingTitle.value = conv.title
}

async function saveEdit(id: string) {
  if (!editingTitle.value.trim()) {
    editingId.value = null
    return
  }
  try {
    await conversationStore.rename(id, editingTitle.value.trim())
    success('Renamed')
  } catch {
    toastError('Failed to rename')
  }
  editingId.value = null
}

async function deleteConv(id: string, event: Event) {
  event.stopPropagation()
  try {
    await conversationStore.remove(id)
    if (route.params['id'] === id) {
      await router.push({ name: 'chat' })
    }
  } catch {
    toastError('Failed to delete conversation')
  }
}

async function togglePin(conv: Conversation, event: Event) {
  event.stopPropagation()
  await conversationStore.pin(conv.id, !conv.pinned)
}

async function navigate(id: string) {
  await router.push({ name: 'chat-conversation', params: { id } })
  emit('close')
}
</script>

<template>
  <div class="conv-list">
    <template v-if="loading">
      <div class="conv-list-loading">
        <div v-for="i in 5" :key="i" class="conv-skeleton" />
      </div>
    </template>

    <template v-else-if="grouped.length === 0">
      <div class="conv-empty">
        <p>No conversations yet.</p>
        <p class="conv-empty-hint">Start a new chat above.</p>
      </div>
    </template>

    <template v-else>
      <div v-for="group in grouped" :key="group.group" class="conv-group">
        <div class="conv-group-label">{{ group.label }}</div>
        <div
          v-for="conv in group.conversations"
          :key="conv.id"
          :class="['conv-item', 'group', { 'conv-item--active': isActive(conv.id) }]"
          @click="navigate(conv.id)"
        >
          <!-- Title / edit -->
          <div v-if="editingId === conv.id" class="conv-edit" @click.stop>
            <input
              v-model="editingTitle"
              class="conv-edit-input"
              type="text"
              autofocus
              @keydown.enter="saveEdit(conv.id)"
              @keydown.escape="editingId = null"
              @blur="saveEdit(conv.id)"
            />
          </div>
          <span v-else class="conv-title">{{ conv.title }}</span>

          <!-- Actions (shown on hover) -->
          <div v-if="editingId !== conv.id" class="conv-actions" @click.stop>
            <button
              :aria-label="conv.pinned ? 'Unpin' : 'Pin'"
              class="conv-action-btn"
              :title="conv.pinned ? 'Unpin' : 'Pin'"
              @click="togglePin(conv, $event)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path v-if="conv.pinned" d="M2 2l8 8M4 2h4l-1 3h2l-3 4-3-4h2L4 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                <path v-else d="M4 2h4l-1 3h2l-3 4-3-4h2L4 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              aria-label="Rename conversation"
              class="conv-action-btn"
              title="Rename"
              @click="startEdit(conv, $event)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 10h1.5L9 4.5l-1.5-1.5L2 8.5V10ZM10.5 3l-1.5-1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              aria-label="Delete conversation"
              class="conv-action-btn conv-action-btn--danger"
              title="Delete"
              @click="deleteConv(conv.id, $event)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.conv-list { @apply flex flex-col py-1; }

.conv-list-loading {
  @apply flex flex-col gap-1 px-2 py-1;
}

.conv-skeleton {
  @apply h-8 rounded-lg bg-surface-200 dark:bg-surface-200 animate-pulse;
}

.conv-empty {
  @apply px-4 py-8 text-center text-xs text-surface-600 dark:text-surface-600;
}

.conv-empty-hint { @apply mt-1 opacity-70; }

.conv-group { @apply mb-2; }

.conv-group-label {
  @apply px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-600 uppercase tracking-wide;
}

.conv-item {
  @apply relative flex items-center gap-2 mx-2 px-3 py-2 rounded-lg cursor-pointer
         text-sm text-surface-800 dark:text-surface-900
         hover:bg-surface-200 dark:hover:bg-surface-200
         transition-colors duration-100;
}

.conv-item--active {
  @apply bg-surface-200 dark:bg-surface-200 text-surface-950 dark:text-surface-950 font-medium;
}

.conv-title {
  @apply flex-1 truncate;
}

.conv-actions {
  @apply hidden group-hover:flex items-center gap-0.5 flex-shrink-0;
}

.conv-item--active .conv-actions {
  @apply flex;
}

.conv-action-btn {
  @apply flex items-center justify-center w-5 h-5 rounded
         text-surface-600 hover:text-surface-950 dark:hover:text-surface-950
         hover:bg-surface-300 dark:hover:bg-surface-300
         transition-colors duration-100;
}

.conv-action-btn--danger:hover {
  @apply text-red-400 bg-red-500/10;
}

.conv-edit { @apply flex-1; }

.conv-edit-input {
  @apply w-full bg-transparent text-sm text-surface-950 dark:text-surface-950
         border-b border-accent-500 outline-none;
}
</style>
