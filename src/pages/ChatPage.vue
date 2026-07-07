<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat.store'
import { useConversationStore } from '@/stores/conversation.store'
import { useProviderStore } from '@/stores/provider.store'
import { useChat } from '@/composables/useChat'
import { useKeyboard } from '@/composables/useKeyboard'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ModelSelector from '@/components/model/ModelSelector.vue'
import ResourcesPanel from '@/components/chat/ResourcesPanel.vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { subscribeToMessages, unsubscribe } from '@/services/supabase/realtime'

import { useReferencesStore } from '@/stores/references.store'
import { useSettingsStore } from '@/stores/settings.store'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const conversationStore = useConversationStore()
const providerStore = useProviderStore()
const refStore = useReferencesStore()
const settingsStore = useSettingsStore()
const { sendMessage, regenerate, abort } = useChat()


watch(
  () => refStore.focusRef,
  (fr) => {
    if (fr) {
      resourcePanelOpen.value = true
    }
  }
)

let realtimeChannel: RealtimeChannel | null = null

function conversationId(): string | undefined {
  const id = route.params['id']
  return typeof id === 'string' ? id : undefined
}

async function loadConversation(id: string) {
  if (realtimeChannel) {
    unsubscribe(realtimeChannel)
    realtimeChannel = null
  }
  await chatStore.loadConversation(id)
  realtimeChannel = subscribeToMessages(id, {
    onUpdate: (msg) => {
      if (msg.id) chatStore.updateMessage(msg.id, msg)
    },
  })
}

onMounted(async () => {
  const id = conversationId()
  if (id) {
    await loadConversation(id)
  } else {
    if (settingsStore.openResourcesOnNewChat) {
      resourcePanelOpen.value = true
    }
  }
})

watch(() => route.params['id'], async (id) => {
  if (typeof id === 'string') {
    if (chatStore.activeConversationId !== id) {
      await loadConversation(id)
    }
  } else {
    chatStore.clearConversation()
    if (settingsStore.openResourcesOnNewChat) {
      resourcePanelOpen.value = true
    }
  }
})

onUnmounted(() => {
  if (realtimeChannel) unsubscribe(realtimeChannel)
})

async function handleSend(content: string, attachments?: any[], metadata?: Record<string, any>) {
  let id = conversationId()
  if (!id) {
    const conv = await conversationStore.create({
      model: providerStore.activeModelId,
      provider: providerStore.activeProvider,
    })
    id = conv.id
    // Set activeConversationId immediately to prevent route watch from double-loading
    chatStore.activeConversationId = id
    await router.push({ name: 'chat-conversation', params: { id } })
    await chatStore.loadConversation(id)
  }
  await sendMessage(content, id, attachments, metadata)
}

async function handleRegenerate() {
  const id = conversationId()
  if (id) await regenerate(id)
}

// Keyboard: Ctrl+Shift+O = new chat
useKeyboard([
  {
    combo: 'ctrl+shift+o',
    handler: async () => {
      await router.push({ name: 'chat' })
    },
    prevent: true,
  },
])

const conv = computed(() => {
  const id = conversationId()
  return id ? conversationStore.getById(id) : null
})

watch(conv, (newConv) => {
  if (newConv) {
    if (newConv.provider && newConv.provider !== providerStore.activeProvider) {
      providerStore.setProvider(newConv.provider as any)
    }
    if (newConv.model && newConv.model !== providerStore.activeModelId) {
      providerStore.setModel(newConv.model)
    }
  } else {
    if (!conversationId()) {
      providerStore.initialize()
    }
  }
}, { immediate: true })

watch(
  [() => providerStore.activeModelId, () => providerStore.activeProvider],
  async ([newModel, newProvider]) => {
    const id = conversationId()
    if (id && conv.value) {
      const modelChanged = conv.value.model !== newModel
      const providerChanged = conv.value.provider !== newProvider
      if (modelChanged || providerChanged) {
        try {
          await conversationStore.update(id, {
            model: newModel,
            provider: newProvider as any,
          })
        } catch (err) {
          console.error('Failed to update conversation settings', err)
        }
      }
    }
  }
)

// ─── Split panel logic ────────────────────────────────────────────────────────
const resourcePanelOpen = ref(false)
const chatPanelWidth = ref(65) // percent
const isDragging = ref(false)
const chatPanelRef = ref<HTMLElement | null>(null)
const splitRef = ref<HTMLElement | null>(null)

function toggleResourcePanel() {
  resourcePanelOpen.value = !resourcePanelOpen.value
}

// Handle direct send from CourseResourcePanel (Teach AI auto-send)
async function handleSendMessage(content: string, metadata?: Record<string, any>) {
  await handleSend(content, [], metadata)
}

function startDrag(e: MouseEvent) {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value || !splitRef.value) return
  const rect = splitRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const pct = (x / rect.width) * 100
  // Clamp between 30% and 80%
  chatPanelWidth.value = Math.min(80, Math.max(30, pct))
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<template>
  <div class="chat-page">
    <!-- Top bar -->
    <div class="chat-topbar">
      <div class="chat-topbar-left">
        <span v-if="conv" class="chat-conv-title">{{ conv.title }}</span>
        <span v-else class="chat-conv-title text-surface-600 dark:text-surface-600">New conversation</span>
      </div>
      <div class="chat-topbar-center">
        <ModelSelector />
      </div>
      <div class="chat-topbar-right">
        <button
          id="resources-toggle-btn"
          class="resources-toggle-btn"
          :class="{ 'resources-toggle-btn--active': resourcePanelOpen }"
          :title="resourcePanelOpen ? 'Hide course resources' : 'Show course resources'"
          :aria-label="resourcePanelOpen ? 'Hide course resources' : 'Show course resources'"
          @click="toggleResourcePanel"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Resources
        </button>
      </div>
    </div>

    <!-- Split body -->
    <div ref="splitRef" class="chat-body" :class="{ 'is-dragging': isDragging }">

      <!-- Chat panel -->
      <div
        ref="chatPanelRef"
        class="chat-panel"
        :style="resourcePanelOpen ? { width: chatPanelWidth + '%' } : { width: '100%' }"
      >
        <ChatMessages class="chat-messages" @regenerate="handleRegenerate" />
        <ChatInput
          :conversation-id="conversationId() ?? ''"
          class="chat-input-area"
          @send="handleSend"
          @abort="abort"
        />
      </div>

      <!-- Drag handle -->
      <div
        v-if="resourcePanelOpen"
        class="drag-handle"
        :class="{ 'drag-handle--dragging': isDragging }"
        aria-hidden="true"
        @mousedown="startDrag"
      >
        <div class="drag-handle-bar" />
      </div>

      <!-- Resource panel -->
      <Transition name="panel-slide">
        <div
          v-show="resourcePanelOpen"
          class="resource-panel"
          :style="{ width: (100 - chatPanelWidth) + '%' }"
        >
          <ResourcesPanel @send-message="handleSendMessage" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  @apply flex flex-col h-full overflow-hidden relative;
}

/* ─── Top bar ──────────────────────────────────────────────────────────── */
.chat-topbar {
  @apply flex items-center justify-between px-4 py-3
         border-b border-surface-200/60 dark:border-surface-200/60
         flex-shrink-0 gap-4 relative z-10;
  background: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(12px);
}

.dark .chat-topbar {
  background: rgba(15, 23, 42, 0.8);
}

.chat-topbar-left  { @apply flex-1 min-w-0; }
.chat-topbar-center { @apply flex items-center justify-center; }
.chat-topbar-right { @apply flex-1 flex items-center justify-end gap-2; }

.chat-conv-title {
  @apply text-sm font-medium text-surface-900 dark:text-surface-900 truncate;
}

/* ─── Resources toggle ─────────────────────────────────────────────────── */
.resources-toggle-btn {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
         text-surface-600 dark:text-surface-700
         hover:bg-surface-200 dark:hover:bg-surface-200
         hover:text-surface-950 dark:hover:text-surface-950
         border border-transparent
         transition-colors duration-150;
}

.resources-toggle-btn--active {
  @apply bg-accent-500/10 dark:bg-accent-500/15
         text-accent-600 dark:text-accent-400
         border-accent-500/30;
}

/* ─── Split body ───────────────────────────────────────────────────────── */
.chat-body {
  @apply flex flex-1 min-h-0 overflow-hidden relative z-10;
}

.chat-body.is-dragging {
  @apply select-none cursor-col-resize;
}

/* ─── Chat panel ───────────────────────────────────────────────────────── */
.chat-panel {
  @apply flex flex-col min-w-0 overflow-hidden flex-shrink-0;
  transition: width 0.0s; /* no transition during drag */
}

.chat-messages   { @apply flex-1 min-h-0; }
.chat-input-area { @apply flex-shrink-0; }

/* ─── Drag handle ──────────────────────────────────────────────────────── */
.drag-handle {
  @apply relative flex-shrink-0 flex items-center justify-center
         w-1 hover:w-1 cursor-col-resize z-10
         bg-surface-200 dark:bg-surface-200
         hover:bg-accent-400 dark:hover:bg-accent-400
         transition-colors duration-150;
}

.drag-handle--dragging {
  @apply bg-accent-500 dark:bg-accent-400;
}

.drag-handle-bar {
  @apply w-0.5 h-8 rounded-full bg-current opacity-50;
}

/* ─── Resource panel ───────────────────────────────────────────────────── */
.resource-panel {
  @apply flex-shrink-0 overflow-hidden min-w-0;
}

/* Slide-in animation */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.15s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}
</style>
